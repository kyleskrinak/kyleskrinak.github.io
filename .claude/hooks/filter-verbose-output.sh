#!/bin/bash
# .claude/hooks/filter-verbose-output.sh
# Filters verbose command output to reduce token consumption

input=$(cat)
cmd=$(echo "$input" | jq -r '.tool_input.command // empty')

# If no command extracted, pass through unchanged
if [ -z "$cmd" ]; then
    echo "{}"
    exit 0
fi

# Filter test output to show only failures
if [[ "$cmd" =~ ^(npm test|yarn test|pytest|cargo test|go test|mvn test) ]]; then
    filtered_cmd="$cmd 2>&1 | grep -A 10 -E '(FAIL|ERROR|error:|✗|×|failed)' | head -100 || echo 'All tests passed'"
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"allow\",\"updatedInput\":{\"command\":\"$filtered_cmd\"}}}"
    exit 0
fi

# Filter log files to show only last 50 lines
if [[ "$cmd" =~ (cat|less|tail).*(\.log|error|debug) ]]; then
    filtered_cmd="tail -50 $cmd"
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"allow\",\"updatedInput\":{\"command\":\"$filtered_cmd\"}}}"
    exit 0
fi

# Default: no filtering
echo "{}"
