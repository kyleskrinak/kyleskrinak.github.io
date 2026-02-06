#!/bin/bash
# .claude/hooks/session-start.sh
# Token optimization reminder for each new session

cat << 'EOF'
🎯 Token Optimization Active

Quick Reminders:
• Use /clear when switching tasks
• Use /compact at ~50% context
• Check /cost periodically
• Disable unused MCP servers with /mcp

Current session: Fresh start (0 tokens)
EOF
