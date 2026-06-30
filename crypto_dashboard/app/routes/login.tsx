import { Form, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/login";
import { createAuthSession, isAuthed, verifyPassword } from "../lib/auth.server";
import { Button, cardStyles, Input } from "../components/ui";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Sign in · Crypto Dashboard" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  if (await isAuthed(request)) throw redirect("/");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");

  if (!verifyPassword(password)) {
    return { error: "Incorrect password. Please try again." } as const;
  }

  return createAuthSession("/");
}

export default function Login({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center px-4">
      <div className={`${cardStyles()} w-full p-8`}>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-content-muted">
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h1 className="text-center text-xl font-bold text-content">
          Crypto Dashboard
        </h1>
        <p className="mt-1 text-center text-sm text-content-muted">
          This dashboard is protected. Enter the shared password to continue.
        </p>

        <Form method="post" className="mt-6 space-y-3">
          <Input
            type="password"
            name="password"
            required
            autoFocus
            placeholder="Password"
            aria-label="Password"
            className="w-full"
          />
          {actionData?.error && (
            <p className="text-sm text-negative">{actionData.error}</p>
          )}
          <Button
            type="submit"
            variant="primary"
            disabled={submitting}
            className="w-full"
          >
            {submitting ? "Checking…" : "Unlock"}
          </Button>
        </Form>
      </div>
    </main>
  );
}
