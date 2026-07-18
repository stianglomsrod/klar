import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  getHelpRequestStateKey,
  getHelpRequestTransition,
  isHelpCommandIntentSatisfied,
} from "../src/lib/help-request-transition.ts";

const generalRequest = {
  id: "10000000-0000-4000-8000-000000000001",
  taskAssignmentId: null,
};
const contextualRequest = {
  ...generalRequest,
  taskAssignmentId: "20000000-0000-4000-8000-000000000001",
};

describe("authoritative student help transition", () => {
  test("keeps a genuine error when authoritative state is unchanged", () => {
    const previous = getHelpRequestStateKey(generalRequest);

    assert.deepEqual(getHelpRequestTransition(previous, generalRequest), {
      changed: false,
      feedback: null,
    });
  });

  test("reconciles a concurrent request without retaining a stale alert", () => {
    assert.deepEqual(getHelpRequestTransition(null, generalRequest), {
      changed: true,
      feedback: "Du står i kø.",
    });
  });

  test("treats task contextualization as a new authoritative state", () => {
    const previous = getHelpRequestStateKey(generalRequest);

    assert.deepEqual(getHelpRequestTransition(previous, contextualRequest), {
      changed: true,
      feedback: "Hjelpen er knyttet til oppgaven.",
    });
  });

  test("announces an external cancellation or resolution calmly", () => {
    const previous = getHelpRequestStateKey(contextualRequest);

    assert.deepEqual(getHelpRequestTransition(previous, null), {
      changed: true,
      feedback: "Du står ikke lenger i kø.",
    });
  });

  test("treats any active request as satisfying a general queue request", () => {
    assert.equal(
      isHelpCommandIntentSatisfied(
        { kind: "request", taskAssignmentId: null },
        contextualRequest,
      ),
      true,
    );
  });

  test("requires the requested task before contextualization is satisfied", () => {
    assert.equal(
      isHelpCommandIntentSatisfied(
        {
          kind: "request",
          taskAssignmentId: contextualRequest.taskAssignmentId,
        },
        generalRequest,
      ),
      false,
    );
    assert.equal(
      isHelpCommandIntentSatisfied(
        {
          kind: "request",
          taskAssignmentId: contextualRequest.taskAssignmentId,
        },
        contextualRequest,
      ),
      true,
    );
  });

  test("does not hide a cancel error after unrelated contextualization", () => {
    assert.equal(
      isHelpCommandIntentSatisfied({ kind: "cancel" }, contextualRequest),
      false,
    );
  });

  test("suppresses a late cancel error after authoritative removal", () => {
    assert.equal(isHelpCommandIntentSatisfied({ kind: "cancel" }, null), true);
  });
});
