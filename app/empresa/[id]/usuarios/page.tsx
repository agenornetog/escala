import { notFound, redirect } from 'next/navigation';
import { UUID } from '@/lib/manager-auth';

export default async function UsersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  redirect('/empresa/' + id + '?secao=usuarios');
}
