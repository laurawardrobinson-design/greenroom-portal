import { redirect } from "next/navigation";

export default function ScanPage() {
  redirect("/gear?scan=true");
}
