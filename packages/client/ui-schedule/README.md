---
description: "Web task management across Sessions and a current-Session reminder catalog."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-schedule

English | [中文](README.zh.md)

## Summary

Manage active and inactive tasks from the Automation tasks page and the right Sidebar task tab: search, filter, edit name, instruction, and run time, browse records, delete, or open the original conversation. Every surface names a task by its title. An open Session's header shows an icon-only reminder clock while active reminders exist and opens that task's detail; a `schedule_create` call renders a transcript card; an idle, unarchived Session row with active tasks shows a clock mark and hover list.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Without recommendations, catalog empty states center within the space below the page controls and remain scrollable on short viewports. With recommendations, the empty state and recommendation tiles stay in normal flow. Filters, input fields, multi-line task rows, and nested rule groups use the shared radius appropriate to their role.

Below 768px, the task list uses 20px horizontal insets, matching the Plugins page.

The shipped Web composition mounts `ui-schedule` with Host Schedule. The Automation tasks sidebar entry opens the task list without selecting or activating a Session. New and the adjacent menu's Create in a session action both open a new conversation with a short task-creation prompt in the current UI language, ready for the user to complete and send. When a blank conversation is reused, the prompt is appended on a new line, preserving its text, inline references, and attachments. The same menu offers Create manually. Manual creation opens the same editor as an existing task, validates required fields, and saves a task without starting an Agent or sending the instruction. A failed request leaves the form and its values visible. The empty state shows a decorative document-and-clock illustration whose colors follow the theme. Below the empty Enabled and All views, eight built-in recommended tasks appear in two columns, each with a glyph, title, description, and default run time. Choosing one opens a new conversation with that task's request prefilled in the same way. Each glyph tile takes the empty-state artwork's background color, and its glyph is drawn in blue with a light blue fill. A deployment that owns the product navigation may claim the Automation tasks entry off the rail through `ui-sidebar`'s `uiSidebarPanels.hidden` service, and the Settings panel's Automation tasks section (ordered after Plugins) keeps the page reachable in that composition — its one action selects the main panel and closes Settings.

Selecting a task from the list opens Rules; refreshing that task preserves the selected tab. Rules edits an active task's name, instruction, and run time; the edits stay in a local draft until saved, and inactive tasks remain read-only. Unmodified Left/Right arrows cycle the tabs, Home/End select the first/last tab, and keyboard focus follows the selection. The tabs do not consume these keys with Alt, Ctrl, Meta, or Shift. The linked-Session control in the detail tab strip stays available on the Rules tab, and confirmed deletion is available from either view.

Rules shows the rule in a Run time card whose rows edit a local draft: Repeat is a menu of Weekly, Monday to Friday, Every day, Every N hours, Every N minutes, Every N seconds, Once, and Custom (cron), a weekly rule adds a Weekday row, a fixed-rate choice edits only the interval quantity in the unit it names, a one-shot rule edits separate Date and Time rows, and Custom (cron) edits one Cron expression row holding a five-field expression, interpreted in the selected time zone. The card parses that expression in the browser and, under the row, shows a localized sentence describing it; an expression the Host would reject shows the localized validation message in place of that sentence and blocks Save. A stored weekly rule whose weekday set is exactly Monday through Friday selects the Monday to Friday choice. The Date row is a read-only trigger showing the staged date as `YYYY/MM/DD` and opening a month calendar with localized weekday headings, month navigation, and a marked today; the draft and the submitted text keep the ISO form; the Time row is a read-only trigger showing one 24-hour clock and opening three scrolling columns of hours, minutes, and seconds with the staged value marked and scrolled into view. A calendar or clock pick stages the draft under the same staged save as every other row, arrow keys walk the open column or grid, Enter stages the marked value, Escape closes the panel and returns focus to its row, and a disabled row cannot open one. Clock rows show whole seconds, an untouched row keeps a stored millisecond value for its submit, and editing a time submits whole-second precision. Time zone is a searchable, height-bounded menu. Its search field takes focus automatically on desktop; phones and tablets require explicit focus. An unlabeled top block keeps the five most recently selected exact zones in browser-local storage; first use seeds the actual system zone and UTC rather than inferring a location from UI language. The system zone is marked, and the remaining inventory is ordered by current UTC offset and canonical IANA id. Each visible label puts `UTC±HH:MM` before the localized zone name; canonical ids stay internal but remain searchable. Zones that ICU renders with the same offset and localized name share one visible row; every grouped id remains searchable, and an already stored id remains selected instead of being rewritten. The inventory comes from `Intl.supportedValuesOf('timeZone')`, and names come from `Intl.DateTimeFormat(..., { timeZoneName: 'longGeneric' })`: both are browser ICU/CLDR data, not a scraped or product-maintained translation table. There is therefore no crawler or generated zone-name resource to refresh. A third-party locale supplies its ordinary `time.locale` value and automatically receives the corresponding ICU names; only the selector's surrounding UI copy needs translation. When the runtime cannot enumerate zones, a short identifier fallback is offered, and a stored zone outside the offered set is kept. Daily, Weekly, and Cron keep their stored rule and IANA zone, and each frequency line names the zone only when it differs from the host's system zone. A one-shot After/At seeds the date and time from the record's stored zone, or this device's zone when the record stores none, so the seeded clock names the stored instant; changing that zone keeps the entered clock values and changes the instant. A kind the card seeds on selection uses the committed occurrence's clock and the choice's zone, which is the record's stored zone or this device's zone, a seeded weekly rule starts from that occurrence's weekday in that zone, and a seeded cron rule states that occurrence's clock as a daily expression. Every accepts at least 60 whole seconds, independent of time zones. One Save submits the complete expected record with the staged change and preserves the id, original Session, latest receipt, and saved history; [Schedule](../../schedule/schedule/README.md#use-this-package) defines future-target selection, reanchoring, and unchanged-rule no-ops.

The rows are disabled while a save is in flight, while the catalog is loading, during a deletion, and for an inactive task. A save bar appears only while the local draft differs from the stored task: it shows Unsaved changes with Cancel and Save changes, and Save changes becomes Saving… while the save is in flight. Cancel restores the stored values. A catalog refresh becomes the shown values only while the draft has no unsaved edit, so an unsaved draft survives an authoritative refresh. A failed save keeps the draft and shows a localized message; after a conflict, retry against the refreshed record. If the task disappears from the catalog, Delete is disabled until the task returns. A successful update refreshes the authoritative catalog. A rejected or unconfirmed update is distinct from a catalog-read failure: Retry reloads the catalog without presenting the update as failed. If the update itself cannot be confirmed, check the task before retrying. Late responses after switching tasks or closing details do not replace the current view, and no failure rolls back a Host write already begun.

Opening Records lazily requests the newest 20 saved records. Load older records adds another page in newest-first append order, independent of wall-clock rollback. The tab strip is the whole header of that view: the editable name and next-run line belong to Rules. Each Saved delivery record leads with a clock glyph and its occurrence time as the locale's month name and clock field pair in the task's zone, or the browser's zone for a one-shot record, and shows the actual saved prompt when present. A prompt longer than two lines shows its first two lines and an Expand toggle, which Collapse reverses; a collapsed prompt rechecks its length when the panel width changes. A legacy receipt without a prompt never substitutes the current instruction.

After the last saved page loads, a nonempty history with confirmed pruning shows a borderless notice at the bottom left of the detail panel. Its info button expands or collapses the current Host retention rules. Empty history, legacy unavailability without confirmed pruning, incomplete pagination, and failed reads show no cleanup notice.

A successful empty history page is distinct from loading, query failure, a missing task, or an invalid cursor. Failed requests retain previously loaded records with a warning and Retry delivery records; an invalid cursor offers Refresh delivery records to reload the newest page. Changing the latest `messageId` refreshes the newest page without switching tabs. Responses superseded by a refresh or received after changing tasks, leaving Records, or closing details do not replace the current view.

The conversation header shows a clock after the first successful catalog read if the conversation is the fixed delivery target of an active task. One task opens its right Sidebar tab. Several open the existing popover. Idle, unarchived Session rows with those tasks show a clock mark and hover list. `schedule_create` continues to render a Turn-level card with a task title, repeat description, and Open action. Persisted legacy and current tool results both render; an authoritative read newer than the card resolves later edits or deletion.

### Time-zone data source

Time-zone inventory and localization are offline. `Intl` reads ICU/CLDR tables embedded in the browser runtime and never fetches or downloads zone data while DSH runs. There is no crawler to refresh; a third-party locale supplies `time.locale` and translates only the selector's own UI copy.

Access: the plugin registers these surfaces only while the current Peer may call `schedule/catalog`, and the Session-header reminder catalog renders only while that Session also allows `schedule/list`; the task tab type and the turn definition stay registered. The owner always has access.

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

Schedule group headings, field labels and hints share an inset text column inside the detail view.

While the Peer may read `schedule/catalog`, the plugin registers the existing `schedules` main panel, Session header utility, Turn tail card, Session row mark and hover entries, and `scheduleTask` right Sidebar tab. Slot injection supplies framework readers and action callbacks; components own selection, search, and paging state. Entry-declared stores retain each task draft and its CAS baseline across navigation within their root or Session scope; the main panel and Session tabs have independent drafts. Pristine forms follow the catalog. A dirty form retains all fields and its original revision. A newer catalog revision prevents saving until the user discards the draft or explicitly reapplies changed title, prompt, timing, and target groups to that revision. Reapplying does not write; the user reviews the resulting form and saves with the new CAS baseline. Untouched groups follow the newer record. Missing tasks retain editable local drafts while Host mutations stay disabled. Drafts are not persisted; a Client reload or disposal of the owning entry or Session scope drops them. The Host owns task storage and execution. Browsing catalogs does not activate a Session. Conflict feedback reuses the catalog notice style; its outlined review action wraps below the message in narrow panes.

A restored task tab carries no navigation parameters, because the Sidebar persists a tab's layout record and not what its opener passed. The page type therefore keeps its own binding from the Session and the layout record's id to the Session and id of the task that record last showed, stored under one `dsh.schedule.task-tab.v1.<sessionId>` localStorage key per Session with one entry per tab id and never any task content. Its body and chip read the entry only for a record without navigation parameters, remove it once a read that succeeded after the tab appeared cannot resolve it, and report no missing task on a binding's behalf. Once such a read leaves the tab without a task identity, the body names that state instead of reporting a load that never finishes.

The manager, task tabs, row marks, and conversation-header projections share one observable `schedule.catalog` source. Header and row views select active records by their fixed delivery target. Mutations use task-id-based `schedule.create`, `schedule.edit`, and `schedule.run`; history uses task identity and cursor without a Session ownership parameter. A mutation acknowledgment triggers a fresh authoritative read; a failed read remains a catalog error rather than changing the acknowledged write into a failure.

Task menus use the [standard menu geometry](../../../docs/ui-radius.md#nested-hover), including keyboard-highlighted rows. Created-task cards follow the [file-card family](../../../docs/ui-radius.md#radius-scale) for their radius and icon-tile material.

</details>

<a id="further-exploration"></a>
## Further Exploration

- [Schedule](../../schedule/schedule/README.md) owns persistence, dispatch, and deletion semantics.
- [Slots](../../../docs/subsystems/slots.md) documents injected hooks and panel contributions.

<a id="model-experience"></a>
## Model Experience

None, as this browser package registers no model tools or automatic messages; the creation prompt and recommended-task requests stay unsent drafts.

#### KV Cache effect

None. Catalog presentation does not enter model requests.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- Saved records describe inbox delivery, not model execution results. Tasks without saved history expose only their existing receipt until new deliveries append records; unsaved earlier records and prompt snapshots cannot be recovered. Previously physically deleted tasks are not restored.
- Twenty-record pages bound the number of records requested, not prompt bytes or the storage a task retains. Delivery history is bounded by the Host plugin's configuration: `deliveryHistoryDays` (default 30) and `deliveryHistoryRecords` (default 200), pruned when an acknowledgment is appended, with the latest receipt always kept and a pruned older window reported as unavailable; see [Schedule limits](../../schedule/schedule/README.md#known-limitations-and-deferred-work).
- Deletion does not cancel a reminder already queued for execution. The linked-Session control in the detail tab strip opens the original conversation through ordinary Session navigation and its recovery policy, not a message-specific jump.
- Reminder creation remains with the Schedule tools. Name, instruction, and run-time edits are available only in the Rules view of an active task, in the Automation tasks page and in the task tab; pausing and immediate execution are not available, and the Run time card's Repeat menu accepts any choice, including one that changes the stored recurrence kind, in which case the target is recomputed from the new rule. The page's New action starts a Session instead of creating a task in place, and the Session-header popover itself has no run-time editor. The Time zone menu offers the runtime's IANA zone inventory, or a short curated list when the runtime cannot enumerate zones.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
