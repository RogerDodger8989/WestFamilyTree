Merge Feature — Manual Test Checklist

This checklist helps validate `mergePersons` implementation and the new merge UI (`MergeModal`).

Setup
- Create a small test dataset with at least 3 persons A, B, C where B and C are duplicates to merge into A.
- Ensure B and C each have:
  - 1-3 events (birth, marriage, death or any custom events)
  - 1-3 relations to other people (parent/child/spouse)
  - Optional: links (external ids) and notes

Basic merge flow
1. Open the app and click the top menubar `Slå ihop` button.
2. In the modal: select person A as target, and select B and C as sources.
3. Preview should show counts of events and relations to transfer.
4. Click `Slå ihop` and confirm the operation.

Expected outcomes
- mergePersons returns a `mergeId` and app shows a status message containing the id.
- Source persons (B and C) are soft-archived: their `person._archived` property is set to `true` and `archiveReason` includes the target and merge id.
- Events from B and C are moved to A's `events` array. Event ids should be unique (no collisions).
- Links from B and C are merged into A.links without overwriting existing keys on A.
- Relations referencing B and/or C in `dbData.relations` are rewritten to reference A instead, and deduplicated where the same relation would appear twice.
- Any relation which would become a self-relation (from === to) is archived.
- `dbData.relations` keeps `_archived` markers for archived relations; active relations remain valid.
- `dbData.meta.merges` contains a snapshot record for this merge id so it can be undone.

Undo check
1. Call `undoMerge(mergeId)` (via console or UI if available).
2. Expected: people B and C are restored to previous state (not archived) and their events/links restored exactly as before. Relations are restored to pre-merge state.

Edge cases
- Merge where some source person id does not exist: operation should skip missing sources and still proceed.
- Merge where a source has no events or relations: operation still archives the person and records snapshot.
- Merge introducing relation duplicates: duplicates should be archived, preserving a single canonical relation.

Developer notes
- If you need to inspect the DB state in the console, access `window.__WFT_DB__` if available or expose a debug helper in the app to `console.log(dbData)` after the merge.
- If unexpected behavior occurs, capture a small JSON export of `dbData` before and after the operation and file a bug report.

Next steps
- Add automated unit tests for `mergePersons` and `undoMerge` using a small in-memory DB fixture.
- Add a confirm/preview step that highlights which relation/rule will be archived vs kept before committing the merge.
