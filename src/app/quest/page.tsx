import { DormQuestView } from "@/components/quest/DormQuestView";
import { getQuestData } from "@/lib/books";

export default function QuestPage() {
  const quest = getQuestData();
  return <DormQuestView quest={quest} />;
}
