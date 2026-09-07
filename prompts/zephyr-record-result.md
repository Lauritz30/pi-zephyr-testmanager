---
description: Record a UAT test result against a test execution
argument-hint: "<testExecutionIdOrKey> <statusName> [comment]"
---
Use zephyr_update_test_execution_status with testExecutionIdOrKey=$1, statusName=$2, and comment=${@:3:-none provided}.

Confirm the update succeeded and report the new status.
