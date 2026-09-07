---
description: Summarize a test cycle's execution progress
argument-hint: "<projectKey> <testCycleIdOrKey>"
---
Use zephyr_list_test_executions with projectKey=$1 and testCycle=$2, then summarize:

- Total executions, and counts per status (Pass/Fail/Blocked/Not Executed)
- Any executions still "Not Executed" so they can be prioritized
- Any "Fail"/"Blocked" executions, with their linked test case keys, so they can be cross-referenced with Jira defects
