import { expectTypeOf, test } from "vitest";

import type {
  ApprovalPoint,
  CitationRef,
  ExecutionPlan,
  ExpectedArtifact,
  TaskActor,
  TaskDetail,
  TaskDraft,
  TaskListItem,
  TaskPage,
  TaskPermissionDecision,
  TaskQuery,
  TaskScope,
  VersionRef,
} from "./model";

test("exposes strict UI contracts without coupling actor identity to role labels", () => {
  expectTypeOf<TaskActor>().toEqualTypeOf<{ userId: string }>();
  expectTypeOf<TaskScope>().toMatchTypeOf<{
    organizationId: string;
    workspaceId: string;
  }>();
  expectTypeOf<TaskDraft>().toBeObject();
  expectTypeOf<TaskListItem>().toBeObject();
  expectTypeOf<TaskDetail>().toBeObject();
  expectTypeOf<ExecutionPlan>().toBeObject();
  expectTypeOf<ApprovalPoint>().toBeObject();
  expectTypeOf<ExpectedArtifact>().toBeObject();
  expectTypeOf<TaskQuery>().toBeObject();
  expectTypeOf<TaskPage>().toBeObject();
  expectTypeOf<TaskPermissionDecision>().toBeObject();
  expectTypeOf<VersionRef>().toBeObject();
  expectTypeOf<CitationRef>().toBeObject();
});
