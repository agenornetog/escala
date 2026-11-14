import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('private avatar bucket restricts read, upload, replacement and removal to the current user folder', async () => {
  const db = new PGlite();
  const own = '00000000-0000-4000-8000-000000000001';
  const other = '00000000-0000-4000-8000-000000000002';
  try {
    await db.exec(`create role authenticated; create role anon;
      create schema storage; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects (bucket_id text, name text, unique(bucket_id, name));
      alter table storage.objects enable row level security;
      grant usage on schema storage, auth to authenticated, anon;
      grant select, insert, update, delete on storage.objects to authenticated, anon;`);
    await db.exec(await readFile('supabase/migrations/20261114183930_escala_account_avatars.sql', 'utf8'));
    const bucket = await db.query<{ public: boolean; file_size_limit: number }>('select public, file_size_limit::int from storage.buckets');
    assert.deepEqual(bucket.rows, [{ public: false, file_size_limit: 2097152 }]);
    await db.query("insert into storage.objects values ('escala-account-avatars',$1),('escala-account-avatars',$2)", [own + '/photo.png', other + '/photo.png']);
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${own}'`);
    assert.deepEqual((await db.query('select name from storage.objects')).rows, [{ name: own + '/photo.png' }]);
    await db.query("insert into storage.objects values ('escala-account-avatars',$1)", [own + '/new.png']);
    await db.query("update storage.objects set name=$1 where name=$2", [own + '/updated.png', own + '/new.png']);
    await assert.rejects(db.query("insert into storage.objects values ('escala-account-avatars',$1)", [other + '/new.png']), { code: '42501' });
    await assert.rejects(db.query('update storage.objects set name=$1 where name=$2', [other + '/stolen.png', own + '/updated.png']), { code: '42501' });
    assert.deepEqual((await db.query('delete from storage.objects where name=$1 returning name', [other + '/photo.png'])).rows, []);
    assert.equal((await db.query('delete from storage.objects where name=$1 returning name', [own + '/updated.png'])).rows.length, 1);
    await db.exec('reset role; set role anon');
    assert.deepEqual((await db.query('select * from storage.objects')).rows, []);
    await assert.rejects(db.query("insert into storage.objects values ('escala-account-avatars',$1)", [own + '/anonymous.png']), { code: '42501' });
  } finally { await db.close(); }
});
