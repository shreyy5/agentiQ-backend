// Against a running local stack. Creates clearly named smoke-test documents.
const assert = require('node:assert/strict');
const JSZip = require('jszip');
const { randomUUID } = require('node:crypto');
const { encode } = require('gpt-tokenizer');
const api = process.env.API_URL || 'http://localhost:53000/api';
const run = randomUUID();

function pdf(text) {
  const stream = 'BT /F1 12 Tf 50 750 Td (' + text + ') Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length ' + Buffer.byteLength(stream) + ' >>\nstream\n' + stream + '\nendstream',
  ];
  let output = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(output));
    output += (i + 1) + ' 0 obj\n' + object + '\nendobj\n';
  });
  const start = Buffer.byteLength(output);
  output += 'xref\n0 6\n0000000000 65535 f \n';
  for (const offset of offsets.slice(1)) output += String(offset).padStart(10, '0') + ' 00000 n \n';
  output += 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + start + '\n%%EOF';
  return Buffer.from(output);
}

async function docx(text) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>' + text + '</w:t></w:r></w:p></w:body></w:document>');
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function upload(filename, content, options = {}, target = '', expected = 201) {
  const body = new FormData();
  if (filename) body.append('file', new Blob([content]), filename);
  for (const [key, value] of Object.entries(options)) body.append(key, String(value));
  const response = await fetch(api + '/documents' + (target ? '/' + target + '/versions' : ''), {
    method: 'POST', body, signal: AbortSignal.timeout(30000),
  });
  const result = await response.json();
  assert.equal(response.status, expected, JSON.stringify(result));
  return result;
}

async function detail(id, versionId) {
  const response = await fetch(api + '/documents/' + id + (versionId ? '?versionId=' + versionId : ''));
  assert.equal(response.status, 200);
  return response.json();
}

async function main() {
  const text = 'AgentiQ smoke ' + run + '\n' + 'Retrieval uses source documents. Unicode: नमस्ते 世界 🧪. '.repeat(180);
  const samples = [
    ['txt', Buffer.from(text)],
    ['md', Buffer.from('# Markdown\n' + text)],
    ['pdf', pdf('AgentiQ PDF smoke ' + run)],
    ['docx', await docx('AgentiQ DOCX smoke ' + run)],
  ];
  let base;
  for (const [extension, buffer] of samples) {
    const result = await upload('smoke-' + run + '.' + extension, buffer);
    const stored = await detail(result.documentId);
    assert(stored.chunks.length > 0);
    assert(stored.chunks.map(c => c.content).join('').includes(run));
    assert.equal(stored.versions[0].tokenCount, result.tokenCount);
    console.log(extension.toUpperCase() + ': parsed and persisted, ' + result.chunkCount + ' chunks');
    if (extension === 'txt') base = result;
  }
  const duplicate = await upload('renamed.txt', samples[0][1]);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.versionId, base.versionId);
  const results = [];
  for (const chunkSize of [200, 500, 1000, 1500]) {
    for (const overlap of [0, 40]) {
      const result = await upload('experiment.txt', samples[0][1], { chunkSize, overlap }, base.documentId);
      assert.equal(result.chunkSize, chunkSize);
      assert.equal(result.overlap, overlap);
      const stored = await detail(base.documentId, result.versionId);
      assert(stored.chunks.every(c => c.tokenCount <= chunkSize && !c.content.includes('�')));
      if (!overlap) assert(stored.chunks.map(c => c.content).join('') === text.normalize('NFKC').trim(), 'Zero-overlap chunks must reconstruct normalized source');
      results.push({ chunkSize, overlap, chunks: result.chunkCount, tokens: result.tokenCount });
    }
  }
  console.table(results);
  const [first, second] = await Promise.all([
    upload('concurrent.txt', Buffer.from('Concurrent ' + run)),
    upload('concurrent.txt', Buffer.from('Concurrent ' + run)),
  ]);
  assert.equal(first.versionId, second.versionId);
  assert.notEqual(first.duplicate, second.duplicate);
  const changes = await Promise.all([
    upload('v-next.txt', Buffer.from('Next A ' + run), {}, base.documentId),
    upload('v-next.txt', Buffer.from('Next B ' + run), {}, base.documentId),
  ]);
  assert.notEqual(changes[0].versionId, changes[1].versionId);
  const versions = (await detail(base.documentId)).versions.map(v => v.versionNumber);
  assert.equal(new Set(versions).size, versions.length);
  const invalidId = await fetch(api + '/documents/not-a-uuid');
  assert.equal(invalidId.status, 400);
  await upload('known.txt', samples[0][1], {}, randomUUID(), 404);
  await upload('invalid.pdf', Buffer.from('not PDF'), {}, '', 400);
  await upload('invalid.docx', Buffer.from('PKbroken'), {}, '', 400);
  await upload('binary.txt', Buffer.from([65, 0, 66]), {}, '', 400);
  await upload('encoding.txt', Buffer.from([255, 254, 255]), {}, '', 400);
  await upload('empty.txt', Buffer.from('  \n '), {}, '', 400);
  await upload('blank.pdf', pdf(''), {}, '', 400);
  await upload('unsupported.exe', Buffer.from('hello'), {}, '', 400);
  await upload('', Buffer.alloc(0), {}, '', 400);
  await upload('bad-options.txt', samples[0][1], { chunkSize: 500, overlap: 500 }, '', 400);
  await upload('large.txt', Buffer.alloc(20 * 1024 * 1024 + 1, 65), {}, '', 413);
  const literal = 'literal <|endoftext|> ' + run;
  const special = await upload('special.txt', Buffer.from(literal));
  assert.equal(special.tokenCount, encode(literal, { disallowedSpecial: new Set() }).length);
  console.log('PASS: all formats, eight chunking experiments, deduplication, version history, concurrency, and validation.');
  console.log('Smoke run: ' + run + '. Created documents remain available in the local dashboard.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
