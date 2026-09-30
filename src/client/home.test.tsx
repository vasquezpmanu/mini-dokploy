// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "../../pages/index";

const mocks = vi.hoisted(() => ({
  useSession: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  redeploy: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("next/head", () => ({ default: () => null }));
vi.mock("@/src/client/auth", () => ({
  authClient: {
    useSession: mocks.useSession,
    signIn: { email: mocks.signIn },
    signUp: { email: mocks.signUp },
    signOut: mocks.signOut,
  },
}));
vi.mock("@/src/client/api", () => ({
  api: {
    deployments: {
      list: { query: mocks.list },
      create: { mutate: mocks.create },
      redeploy: { mutate: mocks.redeploy },
      remove: { mutate: mocks.remove },
    },
  },
}));

const item = {
  id: "abc123abc123",
  serviceName: "mini-dokploy-app-abc123abc123",
  repoUrl: "https://github.com/example/app.git",
  dockerfilePath: "Dockerfile",
  port: 3000,
  customLabels: {},
  domain: "app-abc123abc123.127.0.0.1.sslip.io",
  status: "running",
  revision: 1,
  lastError: null,
};

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }
  close() {}
}

beforeEach(() => {
  vi.clearAllMocks();
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
  mocks.list.mockResolvedValue([]);
  mocks.create.mockResolvedValue(item);
  mocks.redeploy.mockResolvedValue({ ok: true });
  mocks.remove.mockResolvedValue({ ok: true });
  mocks.signIn.mockResolvedValue({ error: null });
  mocks.signUp.mockResolvedValue({ error: null });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Mini-Dokploy page", () => {
  it("shows a loading state while the session is unresolved", () => {
    mocks.useSession.mockReturnValue({ isPending: true, data: null });
    render(<Home />);
    expect(screen.getByText("Loading Mini-Dokploy…")).toBeTruthy();
  });

  it("shows sign-in and submits credentials for an anonymous visitor", async () => {
    mocks.useSession.mockReturnValue({ isPending: false, data: null });
    render(<Home />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alice@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Password123!" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(mocks.signIn).toHaveBeenCalledWith({
        email: "alice@example.com",
        password: "Password123!",
      }),
    );
  });

  it("displays an authentication error and lets the visitor switch modes", async () => {
    mocks.useSession.mockReturnValue({ isPending: false, data: null });
    mocks.signIn.mockResolvedValue({ error: { message: "Invalid password" } });
    render(<Home />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alice@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "WrongPassword123!" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Invalid password");
    fireEvent.click(screen.getByRole("button", { name: "Need an account? Sign up" }));
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Already have an account? Sign in" }));
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
  });

  it("switches to registration and sends the person's name", async () => {
    mocks.useSession.mockReturnValue({ isPending: false, data: null });
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "Need an account? Sign up" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Alice" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alice@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "Password123!" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() =>
      expect(mocks.signUp).toHaveBeenCalledWith({
        name: "Alice",
        email: "alice@example.com",
        password: "Password123!",
      }),
    );
  });

  it("creates a deployment with its Dockerfile, port, and custom labels", async () => {
    mocks.useSession.mockReturnValue({
      isPending: false,
      data: { user: { email: "alice@example.com" } },
    });
    render(<Home />);
    await screen.findByText("No deployments yet");
    fireEvent.change(screen.getByLabelText("Git repository URL"), {
      target: { value: item.repoUrl },
    });
    fireEvent.change(screen.getByLabelText(/Dockerfile path/), {
      target: { value: "docker/Dockerfile" },
    });
    fireEvent.change(screen.getByLabelText(/App port \(inside container\)/), {
      target: { value: "8080" },
    });
    fireEvent.change(screen.getByLabelText(/Custom Docker labels/), {
      target: { value: "team=demo" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Deploy repository" }));
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith({
        repoUrl: item.repoUrl,
        dockerfilePath: "docker/Dockerfile",
        port: 8080,
        customLabels: { team: "demo" },
      }),
    );
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    FakeWebSocket.instances[0].onmessage?.({ data: "Build complete" });
    expect(await screen.findByText("Build complete")).toBeTruthy();
  });

  it("shows malformed labels without submitting a deployment", async () => {
    mocks.useSession.mockReturnValue({
      isPending: false,
      data: { user: { email: "alice@example.com" } },
    });
    render(<Home />);
    fireEvent.change(screen.getByLabelText("Git repository URL"), {
      target: { value: item.repoUrl },
    });
    fireEvent.change(screen.getByLabelText(/App port \(inside container\)/), {
      target: { value: "80" },
    });
    fireEvent.change(screen.getByLabelText(/Custom Docker labels/), {
      target: { value: "not-a-pair" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Deploy repository" }));
    await screen.findByRole("alert");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("warns and focuses the port field instead of deploying when it is empty", async () => {
    mocks.useSession.mockReturnValue({
      isPending: false,
      data: { user: { email: "alice@example.com" } },
    });
    render(<Home />);
    fireEvent.change(screen.getByLabelText("Git repository URL"), {
      target: { value: item.repoUrl },
    });
    fireEvent.click(screen.getByRole("button", { name: "Deploy repository" }));
    const portField = screen.getByLabelText(/App port \(inside container\)/);
    expect(
      await screen.findByText("Choose an internal container port before deploying."),
    ).toBeTruthy();
    expect(document.activeElement).toBe(portField);
    expect(portField.getAttribute("aria-invalid")).toBe("true");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("shows an invalid-port warning on blur and clears it after correction", async () => {
    mocks.useSession.mockReturnValue({
      isPending: false,
      data: { user: { email: "alice@example.com" } },
    });
    render(<Home />);
    const portField = screen.getByLabelText(/App port \(inside container\)/);
    fireEvent.change(portField, { target: { value: "65536" } });
    fireEvent.blur(portField);
    expect(await screen.findByText("Enter a whole-number port between 1 and 65535.")).toBeTruthy();
    fireEvent.change(portField, { target: { value: "80" } });
    expect(screen.queryByText("Enter a whole-number port between 1 and 65535.")).toBeNull();
    expect(portField.getAttribute("aria-invalid")).toBe("false");
  });

  it("lists an owned service and offers redeploy and removal", async () => {
    mocks.useSession.mockReturnValue({
      isPending: false,
      data: { user: { email: "alice@example.com" } },
    });
    mocks.list.mockResolvedValue([item]);
    vi.stubGlobal("confirm", () => true);
    render(<Home />);
    await screen.findByText(item.serviceName);
    fireEvent.click(screen.getByRole("button", { name: "Redeploy" }));
    await waitFor(() => expect(mocks.redeploy).toHaveBeenCalledWith({ id: item.id }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith({ id: item.id }));
  });

  it("summarizes deployment states and exposes details for a selected service", async () => {
    mocks.useSession.mockReturnValue({
      isPending: false,
      data: { user: { email: "alice@example.com" } },
    });
    mocks.list.mockResolvedValue([
      item,
      { ...item, id: "failed123456", serviceName: "failed-service", status: "failed" },
      { ...item, id: "build1234567", serviceName: "building-service", status: "building" },
    ]);
    render(<Home />);
    await screen.findByText("building-service");
    const overview = screen.getByRole("region", { name: "Deployment overview" });
    expect(within(overview).getByText("Total services").nextElementSibling?.textContent).toBe("3");
    expect(within(overview).getByText("Running").nextElementSibling?.textContent).toBe("1");
    expect(within(overview).getByText("In progress").nextElementSibling?.textContent).toBe("1");
    expect(within(overview).getByText("Failed").nextElementSibling?.textContent).toBe("1");
    fireEvent.click(screen.getAllByRole("button", { name: "View logs" })[0]);
    const details = await screen.findByRole("region", { name: "Deployment details" });
    expect(within(details).getByText("Internal port").parentElement).toHaveProperty(
      "textContent",
      "Internal port3000",
    );
    expect(within(details).getByText("Live deployment logs")).toBeTruthy();
  });

  it("reports API errors, signs out, and closes live logs", async () => {
    mocks.useSession.mockReturnValue({
      isPending: false,
      data: { user: { email: "alice@example.com" } },
    });
    mocks.list.mockResolvedValue([item]);
    mocks.redeploy.mockRejectedValue(new Error("Docker unavailable"));
    render(<Home />);
    await screen.findByText(item.serviceName);
    fireEvent.click(screen.getByRole("button", { name: "Redeploy" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Docker unavailable");
    fireEvent.click(screen.getByRole("button", { name: "View logs" }));
    await screen.findByText("Live deployment logs");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByText("Live deployment logs")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });
});
