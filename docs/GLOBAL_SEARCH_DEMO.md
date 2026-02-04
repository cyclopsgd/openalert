# Global Search - Interactive Demo Guide

This guide demonstrates the Global Search feature with step-by-step examples.

## Demo Scenario 1: Finding an Incident by Number

**Goal:** Find incident #123

**Steps:**
1. Press `Cmd + K` (Mac) or `Ctrl + K` (Windows)
2. Type: `123`
3. See result: "Incident #123 - API Gateway Error"
4. Press `Enter` or click to navigate to incident detail page

**Expected Result:** You're taken to `/incidents/123`

## Demo Scenario 2: Searching for Recent Alerts

**Goal:** Find all alerts related to CPU usage

**Steps:**
1. Click the search icon 🔍 in the header
2. Type: `cpu`
3. Review results in the "ALERTS" section
4. Use ↓ arrow to navigate through alerts
5. Press `Enter` on desired alert

**Expected Result:** You see alerts like "High CPU Usage", "CPU Threshold Exceeded", etc.

## Demo Scenario 3: Finding a Service

**Goal:** Locate the API Gateway service

**Steps:**
1. Press `Cmd/Ctrl + K`
2. Type: `gateway`
3. Look in the "SERVICES" section
4. Click "API Gateway"

**Expected Result:** Navigate to `/services/5` (service detail page)

## Demo Scenario 4: Looking Up a Team Member

**Goal:** Find user John Doe

**Steps:**
1. Press `Cmd/Ctrl + K`
2. Type: `john`
3. Check the "USERS" section
4. See: "John Doe - john.doe@example.com (admin)"
5. Select to view in user management

**Expected Result:** Navigate to `/settings/users` with focus on John Doe

## Demo Scenario 5: Keyboard Navigation

**Goal:** Navigate results without using mouse

**Steps:**
1. Press `Cmd/Ctrl + K`
2. Type: `error`
3. Press `↓` (down arrow) - highlights first result
4. Press `↓` again - moves to second result
5. Press `↑` (up arrow) - moves back to first result
6. Press `Enter` - opens the selected result
7. Or press `ESC` - closes search without navigating

**Expected Result:** Smooth keyboard-only navigation

## Demo Scenario 6: Multi-Entity Search

**Goal:** Search for "platform" across all entities

**Steps:**
1. Open search with `Cmd/Ctrl + K`
2. Type: `platform`
3. Observe results in multiple categories:
   - **Incidents**: "Platform API Degradation"
   - **Services**: "Platform Service", "Platform API"
   - **Teams**: "Platform Team"
   - **Users**: No results (unless username contains "platform")

**Expected Result:** Results categorized by entity type

## Demo Scenario 7: No Results Handling

**Goal:** Test search with no matches

**Steps:**
1. Open search
2. Type: `xyz123nonexistent`
3. Wait for search to complete

**Expected Result:**
```
    🔍
No results found for "xyz123nonexistent"
```

## Demo Scenario 8: Quick Incident Resolution Workflow

**Goal:** Find and resolve a critical incident

**Steps:**
1. User reports: "Incident 456 is critical!"
2. Press `Cmd/Ctrl + K` immediately
3. Type: `456`
4. Press `Enter` (first result is auto-selected)
5. You're on incident detail page
6. Click "Acknowledge" or "Resolve" button

**Expected Result:** Fast incident response (< 5 seconds from alert to action)

## Demo Scenario 9: Finding Related Services

**Goal:** Check all services related to authentication

**Steps:**
1. Open search
2. Type: `auth`
3. Review "SERVICES" section
4. See results like:
   - "Auth Service"
   - "OAuth Provider"
   - "Authentication API"
5. Click any to view details and dependencies

**Expected Result:** Comprehensive view of auth-related services

## Demo Scenario 10: Team Discovery

**Goal:** Find which teams exist in the organization

**Steps:**
1. Open search
2. Type: `team` (or partial name if known)
3. Browse "TEAMS" section
4. See all teams with "team" in name
5. Select to view team details

**Expected Result:** Easy team discovery and navigation

## Performance Test

**Goal:** Verify search is fast and responsive

**Test Steps:**
1. Open search
2. Type single character: `a`
3. Observe: "Type at least 2 characters" message
4. Type second character: `ap`
5. Observe: Loading spinner appears
6. Observe: Results appear within ~300ms
7. Type more: `api`
8. Observe: New results appear after debounce delay

**Expected Performance:**
- Modal opens: < 100ms
- Search executes: < 300ms (after debounce)
- Results render: < 50ms
- Total time to results: < 500ms

## Edge Cases Tested

### Empty Search
```
Input: ""
Result: "Type at least 2 characters to search"
```

### Single Character
```
Input: "a"
Result: "Type at least 2 characters to search"
```

### Special Characters
```
Input: "@#$%"
Result: No matches (or matches if special chars in titles)
```

### Very Long Query
```
Input: "this is a very long search query with many words"
Result: Searches normally, no errors
```

### Rapid Typing
```
Input: Type "a", "ap", "api" quickly (< 300ms between)
Result: Only final search "api" is executed (debounced)
```

### Network Error
```
Input: "test" (with API down)
Result: No results shown, no crash, error logged
```

## Real-World Use Cases

### 1. On-Call Engineer
**Scenario:** Wake up to PagerDuty alert at 3 AM

**Workflow:**
- Open laptop → OpenAlert dashboard
- Press `Cmd + K`
- Type incident number from PagerDuty
- Press `Enter`
- Start troubleshooting immediately

**Time Saved:** 30-60 seconds vs traditional navigation

### 2. Service Owner
**Scenario:** Need to check service health before deployment

**Workflow:**
- Open OpenAlert
- Press `Cmd + K`
- Type service name
- Review service status and dependencies
- Make deployment decision

**Time Saved:** 20-30 seconds vs menu navigation

### 3. Manager
**Scenario:** Need to assign user to a team

**Workflow:**
- Press `Cmd + K`
- Type user name
- Navigate to user management
- Assign to team

**Time Saved:** 15-20 seconds vs multi-level navigation

### 4. SRE Investigating Incident
**Scenario:** Multiple alerts firing, need to correlate

**Workflow:**
- Press `Cmd + K`
- Search for common keyword (e.g., "redis")
- See all related incidents, alerts, services
- Identify root cause service
- Take action

**Time Saved:** 1-2 minutes vs manual correlation

## Keyboard Shortcuts Mastery

**Beginner Level:**
- Open search: `Cmd/Ctrl + K`
- Close search: `ESC`

**Intermediate Level:**
- Navigate: `↑` / `↓`
- Select: `Enter`
- Quick search → select: `Cmd+K` → type → `Enter`

**Advanced Level:**
- Rapid incident lookup: `Cmd+K` → `123` → `Enter` (3 keys)
- Multi-entity scan: `Cmd+K` → `keyword` → review all categories
- Keyboard-only workflow: Never touch mouse

## Tips for Power Users

1. **Memorize Common Searches**
   - Frequent incidents: Store numbers mentally
   - Regular services: Remember partial names
   - Team names: Use abbreviations

2. **Use Specific Keywords**
   - Instead of "error" → "api gateway error"
   - Instead of "down" → "service down monitoring"

3. **Combine with Browser Features**
   - Use browser back/forward after search navigation
   - Open search results in new tab (future feature)

4. **Create Muscle Memory**
   - Practice: `Cmd+K` → type → `Enter`
   - Goal: < 2 seconds from idea to action

5. **Keyboard Navigation Flow**
   ```
   Cmd+K → type → (wait 300ms) → ↓↓ → Enter
   (Open)  (Search) (Debounce)  (Navigate) (Go)
   ```

## Visual Feedback Guide

### States and Their Meanings

**Idle State:**
```
    🔍
Type at least 2 characters to search
```
*Meaning:* Ready for input

**Loading State:**
```
    ⏳
Searching...
```
*Meaning:* API request in progress

**Results State:**
```
INCIDENTS (3)
ALERTS (5)
SERVICES (2)
```
*Meaning:* Found matches, categorized

**No Results State:**
```
    🔍
No results found
```
*Meaning:* Query valid but no matches

**Selected Item:**
```
→ #123 - API Gateway Error    [highlighted]
  #124 - Database Connection
```
*Meaning:* Ready to navigate

## Accessibility Features

- **Keyboard Navigation:** Full support
- **Focus Management:** Auto-focus on input
- **Visual Indicators:** Clear selection highlight
- **Screen Reader:** Basic support (labels present)

## Mobile Considerations

**Note:** Global Search is optimized for desktop use. On mobile:
- Search icon is available in header
- Keyboard shortcut not applicable
- Touch navigation works
- Modal is responsive

## Browser Compatibility

**Tested On:**
- ✅ Chrome 120+
- ✅ Firefox 120+
- ✅ Safari 17+
- ✅ Edge 120+

**Not Supported:**
- ❌ Internet Explorer
- ❌ Browsers with JavaScript disabled

## Troubleshooting Demo Issues

**Issue:** Modal doesn't open
**Fix:** Refresh page, check console for errors

**Issue:** No results for known entities
**Fix:** Verify API is running, check authentication

**Issue:** Keyboard shortcut conflicts
**Fix:** Use search icon instead, check OS shortcuts

**Issue:** Slow performance
**Fix:** Check network tab, verify database indexes

## Next Steps

After completing demos:
1. Practice keyboard shortcuts daily
2. Learn search patterns for your workflow
3. Share tips with team members
4. Provide feedback for improvements

## Demo Checklist

Before demonstrating to others:

- [ ] API is running and accessible
- [ ] Database has sample data
- [ ] User is authenticated
- [ ] Test keyboard shortcut works
- [ ] Test search icon works
- [ ] Test all entity types return results
- [ ] Test keyboard navigation
- [ ] Test edge cases (empty, no results)
- [ ] Test navigation from results
- [ ] Prepare specific examples

## Recording a Demo

**For Video/Screen Recording:**
1. Clear browser history/cache for clean demo
2. Prepare sample data in advance
3. Slow down typing for visibility
4. Show keyboard shortcut keys on screen
5. Narrate each action
6. Highlight results as they appear
7. Demonstrate navigation
8. Show multiple use cases

**Demo Script:**
```
"Let me show you the Global Search feature.
Press Cmd+K... [modal opens]
Type 'api'... [results appear]
Use arrow keys to navigate... [highlight moves]
Press Enter... [navigate to result]
That's it! Fast and efficient."
```

---

**Want to practice?** Start with simple searches and gradually increase complexity. The more you use it, the faster you'll become!
