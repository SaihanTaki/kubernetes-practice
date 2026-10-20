import { describe, expect, it } from "vitest";
import { createCluster, run, type Cluster } from "@/lib/simulator";

function exec(c: Cluster, ...commands: string[]) {
  let output = "";
  let error = false;
  for (const cmd of commands) ({ cluster: c, output, error } = run(c, cmd));
  return { c, output, error };
}

/** A running busybox Pod "box" and a running nginx Pod "web". */
const cluster = () =>
  exec(createCluster({ pods: [{ name: "box", image: "busybox:1.36", labels: { app: "box" } }, { name: "web", image: "nginx:1.27" }] }), "kubectl get pods").c;

describe("kubectl exec", () => {
  it("writes with sh -c and reads back with cat", () => {
    let c = cluster();
    let r = exec(c, "kubectl exec box -- sh -c 'echo hello from box > /tmp/a.txt'");
    expect(r).toMatchObject({ output: "", error: false });
    c = r.c;
    expect(exec(c, "kubectl exec box -- cat /tmp/a.txt").output).toBe("hello from box");
    r = exec(c, `kubectl exec box -- sh -c "echo 'one; two' >> /tmp/a.txt && cat /tmp/a.txt"`);
    expect(r.output).toBe("hello from box\none; two");
    expect(exec(c, "kubectl exec -it box -- echo hi there").output).toBe("hi there");
    expect(exec(c, "kubectl exec pod/box -c busybox -- ls /tmp").output).toBe("a.txt");
  });

  it("keeps files per Pod", () => {
    const c = exec(cluster(), "kubectl exec box -- sh -c 'echo x > /tmp/a'").c;
    expect(exec(c, "kubectl exec web -- cat /tmp/a").output).toBe("cat: /tmp/a: No such file or directory\ncommand terminated with exit code 1");
  });

  it("reports command errors with the exit code, in the image's wording", () => {
    const c = cluster();
    expect(exec(c, "kubectl exec box -- cat /nope")).toMatchObject({ error: true, output: "cat: can't open '/nope': No such file or directory\ncommand terminated with exit code 1" });
    expect(exec(c, "kubectl exec box -- ls /nope").output).toBe("ls: /nope: No such file or directory\ncommand terminated with exit code 1");
    expect(exec(c, "kubectl exec web -- ls /nope").output).toBe("ls: cannot access '/nope': No such file or directory\ncommand terminated with exit code 2");
    expect(exec(c, "kubectl exec box -- cat /tmp").output).toBe("cat: read error: Is a directory\ncommand terminated with exit code 1");
    expect(exec(c, "kubectl exec box -- sh -c 'echo x > /tmp'").output).toBe("sh: can't create /tmp: Is a directory\ncommand terminated with exit code 1");
    expect(exec(c, "kubectl exec box -- sh -c 'echo \"x'").output).toMatch(/unterminated quoted string\ncommand terminated with exit code 2$/);
    expect(exec(c, "kubectl exec box -- sh -c 'ls | cat'").output).toMatch(/not supported in this simulator/);
  });

  it("lists directories including mount points", () => {
    expect(exec(cluster(), "kubectl exec box -- ls /").output.split("\n")).toEqual(["bin", "dev", "etc", "home", "proc", "root", "sys", "tmp", "usr", "var"]);
  });

  it("names the supported commands for anything else", () => {
    expect(exec(cluster(), "kubectl exec box -- rm -rf /").output).toBe("error: the simulator only supports cat, ls and echo in exec, directly or inside sh -c '...'");
    expect(exec(cluster(), "kubectl exec box -- sh -c 'echo ok; reboot'").error).toBe(true);
  });

  it("validates the Pod, container and command", () => {
    const c = cluster();
    expect(exec(c, "kubectl exec nope -- ls").output).toBe('Error from server (NotFound): pods "nope" not found');
    expect(exec(c, "kubectl exec box -c other -- ls").output).toBe("Error from server (BadRequest): container other is not valid for pod box");
    expect(exec(c, "kubectl exec box").output).toMatch(/^error: you must specify at least one command/);
    expect(exec(c, "kubectl exec box ls").error).toBe(true);
    expect(exec(c, "kubectl get pods -it").error).toBe(true);
    expect(exec(c, "kubectl get pods -c box").output).toBe("error: -c is only supported with kubectl logs and exec");
  });

  it("refuses Pods that are not running", () => {
    const c = exec(createCluster(), "kubectl run box --image=busybox:1.36").c;
    expect(exec(c, "kubectl exec box -- ls").output).toBe('error: unable to upgrade connection: container not found ("busybox")');
    const job = exec(createCluster(), "kubectl create job j --image=busybox:1.36 -- echo hi", "kubectl get pods", "kubectl get pods").c;
    const name = job.resources.find((r) => r.kind === "Pod")!.metadata.name;
    expect(exec(job, `kubectl exec ${name} -- ls`).output).toBe("error: cannot exec into a container in a completed pod; current phase is Succeeded");
  });

  it("execs into the first Pod of a workload", () => {
    const c = exec(createCluster({ deployments: [{ name: "api", replicas: 2, image: "busybox:1.36", labels: { app: "api" } }] }), "kubectl get pods").c;
    expect(exec(c, "kubectl exec deploy/api -- echo ok").output).toBe("ok");
    expect(exec(c, "kubectl exec deploy/nope -- echo ok").output).toBe('Error from server (NotFound): deployments.apps "nope" not found');
  });
});
