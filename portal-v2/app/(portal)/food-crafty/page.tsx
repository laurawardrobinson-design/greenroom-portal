import { redirect } from "next/navigation";

export default function FoodCraftyRedirect() {
  redirect("/studio?tab=food");
}
