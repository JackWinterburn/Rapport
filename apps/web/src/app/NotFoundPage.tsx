import { Link } from "react-router";
import { Compass } from "lucide-react";
import { EmptyState } from "../ui";

export function NotFoundPage() {
  return (
    <EmptyState icon={<Compass />} title="Page not found" action={<Link to="/" className="ui-btn ui-btn--secondary ui-btn--md">Back to contacts</Link>}>
      That page doesn't exist.
    </EmptyState>
  );
}
