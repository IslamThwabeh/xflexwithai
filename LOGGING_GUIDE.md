# XFlex Trading Academy - Logging Guide

## Overview

The application includes comprehensive logging to help debug issues in production environments like Railway. Logging can be enabled or disabled via environment variables.

---

## Environment Variables

### Enable Debug Logging

To enable detailed logging (recommended for development and debugging):

```bash
DEBUG_LOGGING=true
```

### Disable Debug Logging (Production Mode)

To disable debug logging (recommended for production):

```bash
DEBUG_LOGGING=false
```

Or simply omit the `DEBUG_LOGGING` variable entirely.

---

## Log Levels

The logging system uses four log levels:

1. **ERROR** - Always logged, regardless of `DEBUG_LOGGING` setting
   - Database connection failures
   - Authentication errors
   - Missing enrollments or resources

2. **WARN** - Always logged, regardless of `DEBUG_LOGGING` setting
   - Duplicate enrollment attempts
   - Invalid operations

3. **INFO** - Only logged when `DEBUG_LOGGING=true`
   - Successful operations (course created, user enrolled, etc.)
   - Authentication events
   - Progress updates

4. **DEBUG** - Only logged when `DEBUG_LOGGING=true`
   - Database operations
   - Detailed procedure calls
   - Authentication attempts

---

## What Gets Logged

### Authentication Events
```
[2025-11-09T10:15:30.123Z] [INFO] Auth: User authenticated | {"userId":123,"email":"user@example.com"}
```

### tRPC Procedure Calls
```
[2025-11-09T10:15:31.456Z] [INFO] tRPC Procedure: courses.create | {"input":{"title":"Trading 101"},"userId":1}
```

### Database Operations
```
[2025-11-09T10:15:32.789Z] [DEBUG] Database: Database connection established
```

### Success Operations
```
[2025-11-09T10:15:33.012Z] [INFO] Course created successfully | {"courseId":5}
[2025-11-09T10:15:34.345Z] [INFO] User enrolled in course successfully | {"enrollmentId":10,"userId":123,"courseId":5}
```

### Errors
```
[2025-11-09T10:15:35.678Z] [ERROR] Database connection failed | {"error":"Connection timeout"}
[2025-11-09T10:15:36.901Z] [ERROR] Enrollment not found for episode completion | {"userId":123,"courseId":5}
```

### Warnings
```
[2025-11-09T10:15:37.234Z] [WARN] User already enrolled in course | {"userId":123,"courseId":5}
```

---

## Logged Operations

### Course Management
- ✅ Course creation (`courses.create`)
- ✅ Course updates (`courses.update`)
- ✅ Course deletion (`courses.delete`)
- Course retrieval (only in debug mode)

### Enrollment Management
- ✅ User enrollment (`enrollments.enroll`)
- ✅ Enrollment retrieval (`enrollments.myEnrollments`)
- ✅ Episode completion (`enrollments.markEpisodeComplete`)
- Progress updates

### Authentication
- ✅ User authentication attempts
- ✅ Successful logins
- ✅ Failed authentication

### Database
- ✅ Connection establishment
- ✅ Connection failures
- Database queries (in debug mode)

---

## How to Use Logging for Debugging

### On Railway

1. **Enable Logging**
   - Go to your Railway project settings
   - Add environment variable: `DEBUG_LOGGING=true`
   - Redeploy the application

2. **View Logs**
   - Open Railway dashboard
   - Navigate to your service
   - Click on "Logs" tab
   - Filter by log level or search for specific operations

3. **Common Debugging Scenarios**

   **User can't enroll in course:**
   ```bash
   # Search logs for:
   "enrollments.enroll"
   
   # Look for errors like:
   "User already enrolled in course"
   "Course not found"
   ```

   **Episode completion not working:**
   ```bash
   # Search logs for:
   "markEpisodeComplete"
   
   # Check for:
   "Enrollment not found for episode completion"
   "Episode marked as complete"
   ```

   **Database connection issues:**
   ```bash
   # Search logs for:
   "Database connection"
   
   # Look for:
   "Database connection failed"
   ```

### Local Development

1. **Enable Logging**
   ```bash
   # In your .env file
   DEBUG_LOGGING=true
   ```

2. **Run the application**
   ```bash
   pnpm dev
   ```

3. **Monitor Console**
   - All logs will appear in your terminal
   - Use `grep` to filter specific operations:
   ```bash
   pnpm dev 2>&1 | grep "courses.create"
   ```

---

## Performance Considerations

### Production Recommendations

- **Disable debug logging** (`DEBUG_LOGGING=false`) to reduce log volume
- Errors and warnings will still be logged for critical issues
- Re-enable temporarily when investigating issues

### Log Volume Estimates

With `DEBUG_LOGGING=true`:
- ~5-10 log entries per user request
- ~2-3 log entries per database operation
- ~1-2 log entries per authentication attempt

With `DEBUG_LOGGING=false`:
- Only errors and warnings are logged
- Significantly reduced log volume (~90% reduction)

---

## Extending Logging

### Adding Logs to New Procedures

```typescript
import { logger } from "./_core/logger";

// In your tRPC procedure:
myProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ input, ctx }) => {
    // Log the procedure call
    logger.procedure('myFeature.myAction', input, ctx.user?.id);
    
    try {
      // Your logic here
      const result = await doSomething(input.id);
      
      // Log success
      logger.info('Action completed successfully', { id: input.id, result });
      
      return result;
    } catch (error) {
      // Log error
      logger.error('Action failed', { 
        id: input.id, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  });
```

### Adding Database Logs

```typescript
export async function myDatabaseFunction(id: number) {
  logger.db('Executing myDatabaseFunction', { id });
  
  const db = await getDb();
  const result = await db.select().from(myTable).where(eq(myTable.id, id));
  
  logger.db('Query completed', { rowCount: result.length });
  
  return result;
}
```

---

## Troubleshooting

### Logs Not Appearing

1. **Check environment variable**
   ```bash
   echo $DEBUG_LOGGING
   ```
   Should output: `true`

2. **Restart the application**
   After changing `DEBUG_LOGGING`, restart is required

3. **Check Railway deployment**
   Ensure environment variable is set in Railway dashboard

### Too Many Logs

1. **Disable debug logging**
   ```bash
   DEBUG_LOGGING=false
   ```

2. **Filter logs in Railway**
   - Use the search/filter feature
   - Focus on ERROR and WARN levels

### Log Format Issues

- All logs use ISO 8601 timestamps
- Context is JSON-formatted for easy parsing
- Compatible with log aggregation tools (Datadog, LogRocket, etc.)

---

## Best Practices

1. **Enable logging during development** to catch issues early
2. **Disable logging in production** unless actively debugging
3. **Always log errors** regardless of environment
4. **Include relevant context** (user ID, resource ID, etc.)
5. **Use appropriate log levels** (don't log everything as ERROR)
6. **Monitor log volume** to avoid excessive costs on Railway

---

## Support

If you encounter issues with logging:
1. Check this guide first
2. Verify environment variables are set correctly
3. Restart the application after changes
4. Check Railway logs for any startup errors

---

**Last Updated:** November 9, 2025
