import ListDetail from "@components/profile/ListDetail";
import { notFound } from "next/navigation";

type PageProps = { params: Promise<{ listId: string }> };

export default async function ListPage({ params }: PageProps) {
  const { listId } = await params;
  const id = Number(listId);
  if (!Number.isInteger(id)) {
    notFound();
  }
  return <ListDetail listId={id} />;
}
