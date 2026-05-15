---
name: kubernetes-deployment
description: Use when investigating pod failures, parsing container logs, writing OKD/Kubernetes manifests, or deploying multi-container architectures. Enforces safe infrastructure investigation without breaking live environments.
---

# Kubernetes & Infrastructure Management

## Overview
Infrastructure code and cluster states are fragile. Guess-and-check commands against a live cluster can cause catastrophic downtime, lost data, or cascading failures across dependent microservices. 

This skill governs how you interact with Kubernetes (k8s), OKD clusters, Docker Compose, and multi-container environments.

## The Prime Directive
**NEVER execute a destructive command (`delete`, `scale --replicas=0`, `drop`) without explicitly confirming with the user AND backing up the current state.**

## Phase 1: Investigation (Read-Only)

When a pod is failing (e.g., `CrashLoopBackOff` or `Error`), you must execute these steps sequentially before attempting any fix:

1. **Verify Cluster State:**
   - Run `kubectl get pods -n <namespace>` or `oc get pods` to identify the exact failing pod name.
   - Run `kubectl describe pod <pod-name>` and look specifically at the `Events` at the bottom. This reveals scheduling errors, OOMKills, or ImagePullBackOffs.

2. **Parse the Logs:**
   - Run `kubectl logs <pod-name> --previous` if the pod is crash-looping to see why it died.
   - Do NOT just look at the last line. Read the full stack trace. 
   - If there are multiple containers in a pod, specify the container: `kubectl logs <pod-name> -c <container-name>`.

3. **Check the Environment:**
   - 90% of deployment failures are missing secrets or misconfigured environment variables.
   - Verify secrets using `kubectl get secret <secret-name> -o yaml` (do not print decoded production secrets).
   - Verify config maps using `kubectl get configmap <map-name> -o yaml`.

## Phase 2: Manifest Generation & Modification

When writing or modifying YAML manifests (Deployments, Services, Ingresses, PVCs):

1. **Dry-Run Everything:**
   - Before applying a new manifest, test it: `kubectl apply -f manifest.yaml --dry-run=client`
   - If using Kustomize: `kubectl kustomize <dir>` to verify the final output before applying.

2. **Strict Manifest Rules:**
   - **Resource Limits:** EVERY deployment must include `resources.requests` and `resources.limits`. Never deploy unbounded pods.
   - **Probes:** EVERY deployment must include `livenessProbe` and `readinessProbe` to ensure the orchestrator knows when the app is actually ready.
   - **Labels:** Use consistent labels (e.g., `app.kubernetes.io/name`) to ensure Services map correctly to Deployments.

## Phase 3: Networking & Connectivity

If a service cannot reach another service (e.g., `hermes-ui` cannot reach `swim-db`):

1. Do NOT immediately change the code. 
2. Verify the Service exists: `kubectl get svc`.
3. Verify the Endpoints: `kubectl get endpoints <service-name>`. If endpoints are empty, the pod labels do not match the service selector.
4. Test connectivity from inside the cluster using a temporary busybox/curl pod:
   `kubectl run curl-test --image=radial/busyboxplus:curl -i --tty --rm`

## Red Flags - STOP

- Executing `kubectl delete deployment <name>` without dumping it to a YAML backup first.
- Blindly applying YAML without a `--dry-run`.
- Assuming a network timeout is a code issue before verifying cluster DNS or Service endpoints.

**MANDATORY:** Before concluding an infrastructure fix is "done", you MUST invoke the `verification-before-completion` skill to empirically prove the pod is running and passing its readiness probes.
