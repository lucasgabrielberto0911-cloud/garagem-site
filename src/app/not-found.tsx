import SiteLayout from "@/app/(site)/layout";
import { NotFoundContent } from "@/components/site/NotFoundContent";

export default function RootNotFound() {
  return (
    <SiteLayout>
      <NotFoundContent />
    </SiteLayout>
  );
}
