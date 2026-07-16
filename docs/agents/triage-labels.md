# Triage And Wayfinder Labels

Skills use canonical role names. This file maps those roles to GitHub labels.

## Triage States

| Canonical role    | GitHub label        | Meaning                                          |
| ----------------- | ------------------- | ------------------------------------------------ |
| `needs-triage`    | `needs-triage`      | Maintainer needs to evaluate this issue          |
| `needs-info`      | `needs-info`        | Waiting on the reporter for more information     |
| `ready-for-agent` | `ready-for-agent`   | Fully specified and ready for an AFK agent       |
| `ready-for-human` | `ready-for-human`   | Requires human implementation                    |
| `wontfix`         | `wontfix`           | Will not be actioned                             |

## Wayfinder Artifacts

| Canonical role          | GitHub label              | Meaning                                        |
| ----------------------- | ------------------------- | ---------------------------------------------- |
| `wayfinder:map`         | `wayfinder:map`           | Shared map for one effort                      |
| `wayfinder:research`    | `wayfinder:research`      | AFK research ticket                            |
| `wayfinder:prototype`   | `wayfinder:prototype`     | Prototype ticket                               |
| `wayfinder:grilling`    | `wayfinder:grilling`      | Decision-making conversation                   |
| `wayfinder:task`        | `wayfinder:task`          | Prerequisite work that unblocks a decision     |

When a skill mentions a canonical role, use its corresponding GitHub label.
