import { Form } from "react-router";
import { Button } from "./ui";

/** Posts to /logout to clear the shared-password session. */
export function LogoutButton() {
  return (
    <Form method="post" action="/logout">
      <Button type="submit" variant="secondary" title="Log out">
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5M21 12H9" />
        </svg>
        Log out
      </Button>
    </Form>
  );
}
