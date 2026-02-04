# Global Search - Quick Start Guide

## Overview

The Global Search feature allows you to quickly find incidents, alerts, services, teams, and users from anywhere in the application.

## How to Use

### Opening the Search

There are two ways to open the global search:

1. **Keyboard Shortcut** (Recommended):
   - **Mac**: Press `Cmd + K`
   - **Windows/Linux**: Press `Ctrl + K`

2. **Search Icon**:
   - Click the search icon (🔍) in the header navigation bar

### Performing a Search

1. Once the search modal opens, start typing your search query
2. You need to type at least **2 characters** for results to appear
3. Results will appear automatically after a brief delay (300ms)
4. Results are grouped by category: Incidents, Alerts, Services, Teams, Users

### Navigating Results

#### Using Mouse:
- Click any result to navigate to its detail page

#### Using Keyboard:
- Press `↓` (Down Arrow) to move to the next result
- Press `↑` (Up Arrow) to move to the previous result
- Press `Enter` to open the selected result
- Press `ESC` to close the search modal

### Search Examples

#### Search by Incident Number:
- Type: `123`
- Finds: Incident #123 (exact match)

#### Search by Title/Name:
- Type: `api error`
- Finds: All incidents, alerts, or services with "api error" in their title

#### Search for a User:
- Type: `john`
- Finds: Users with "john" in their name or email

#### Search for a Service:
- Type: `gateway`
- Finds: Services with "gateway" in their name or description

#### Search for a Team:
- Type: `platform`
- Finds: Teams with "platform" in their name

## What You Can Search

### Incidents
- **Search by**: Incident number (exact match) or title (partial match)
- **Navigates to**: Incident detail page
- **Shows**: Incident number, title, severity, status, triggered time

### Alerts
- **Search by**: Title or description (partial match)
- **Navigates to**: Alerts list page
- **Shows**: Alert title, description, severity, status

### Services
- **Search by**: Name or description (partial match)
- **Navigates to**: Service detail page
- **Shows**: Service name and description

### Teams
- **Search by**: Name or description (partial match)
- **Navigates to**: Team management page
- **Shows**: Team name and description

### Users
- **Search by**: Name or email (partial match)
- **Navigates to**: User management page
- **Shows**: User name, email, and role

## Tips & Tricks

### Quick Navigation
- Use the keyboard shortcut `Cmd/Ctrl + K` for fastest access
- Keep your fingers on the keyboard for maximum efficiency

### Finding Incidents
- If you know the incident number, just type it directly
- For recent incidents, search by keywords from the title

### Refining Your Search
- Be specific: "api gateway error" is better than just "error"
- Use unique words that are likely in the title or description

### Result Limits
- By default, you'll see up to 5 results per category
- If you don't see what you're looking for, try more specific keywords

## Visual Guide

```
┌─────────────────────────────────────────────────────────────┐
│  🔍 Search incidents, alerts, services, teams, users...  ESC │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  INCIDENTS                                                    │
│  🔴 #123 - API Gateway Error                      critical   │
│      Jan 1, 2025, 10:00 AM                                   │
│                                                               │
│  ALERTS                                                       │
│  🔔 High CPU Usage                                firing     │
│      CPU usage above 90%                                     │
│                                                               │
│  SERVICES                                                     │
│  🖥️  API Gateway                                             │
│      Main API Gateway service                                │
│                                                               │
│  TEAMS                                                        │
│  👥 Platform Team                                            │
│      Infrastructure and platform services                    │
│                                                               │
│  USERS                                                        │
│  👤 John Doe                                      admin      │
│      john.doe@example.com                                    │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│  ↑↓ Navigate   ↵ Select                           ESC Close │
└─────────────────────────────────────────────────────────────┘
```

## States

### Empty Search
When you first open the search or clear your query:
```
    🔍
Type at least 2 characters to search
Search across incidents, alerts, services, teams, and users
```

### Loading
While searching:
```
    ⏳ (spinning)
Searching...
```

### No Results
When your search doesn't match anything:
```
    🔍
No results found for "xyz123"
```

## Troubleshooting

### Search not opening with keyboard shortcut
- Make sure you're not in a text input field
- Check if your browser or OS is intercepting the shortcut
- Try clicking the search icon instead

### Results not appearing
- Make sure you've typed at least 2 characters
- Wait a moment (300ms debounce delay)
- Check your network connection

### Wrong results appearing
- Try more specific keywords
- Use exact incident numbers for precise matching
- Check spelling of your search terms

## Keyboard Shortcuts Reference

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Open search |
| `ESC` | Close search |
| `↓` | Next result |
| `↑` | Previous result |
| `Enter` | Open selected result |
| `Tab` | Move focus (in input) |

## Best Practices

1. **Use keyboard shortcuts** for faster navigation
2. **Be specific** in your search queries
3. **Use incident numbers** when you know them
4. **Search by unique keywords** for better results
5. **Navigate with arrows** instead of mouse for speed

## Common Use Cases

### Finding a Specific Incident
1. Press `Cmd/Ctrl + K`
2. Type the incident number (e.g., "123")
3. Press `Enter` to open

### Checking Recent Alerts
1. Press `Cmd/Ctrl + K`
2. Type a keyword from the alert (e.g., "cpu")
3. Browse the alerts section
4. Click or press `Enter` on the desired alert

### Looking Up a Team Member
1. Press `Cmd/Ctrl + K`
2. Type their name or email
3. Navigate to the users section
4. Select the user to view their profile

### Finding a Service
1. Press `Cmd/Ctrl + K`
2. Type the service name
3. Select from the services section
4. Navigate to the service detail page

## Accessibility

- **Keyboard navigation**: Fully supported with arrow keys
- **Focus management**: Automatic focus on input when opened
- **Screen readers**: Basic support (can be enhanced)
- **Visual indicators**: Clear selection highlighting

## Performance

- **Instant results**: Searches complete in milliseconds
- **Debounced input**: Reduces server load
- **Cached results**: Fast subsequent searches
- **Limited results**: Shows most relevant matches first

## Privacy & Security

- **Authentication required**: Must be logged in to search
- **Team-based access**: Results respect your permissions
- **Secure queries**: All searches are encrypted (HTTPS)
- **No tracking**: Search queries are not stored

## Support

For issues or questions:
- See full documentation: `docs/GLOBAL_SEARCH_DOCUMENTATION.md`
- Contact your system administrator
- Check troubleshooting section above

---

**Pro Tip**: Master the keyboard shortcuts for the fastest workflow! Once you get used to `Cmd/Ctrl + K`, you'll wonder how you lived without it.
