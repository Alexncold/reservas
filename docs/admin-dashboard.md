# GameHub Admin Dashboard

## Overview

The GameHub Admin Dashboard provides a centralized interface for monitoring and managing the GameHub reservation system. It includes real-time metrics, alert management, and system logs to help administrators maintain system health and quickly respond to issues.

## Accessing the Dashboard

1. Navigate to `/admin/dashboard` in your browser
2. Log in with your admin credentials

> **Note**: Only users with the `admin` role can access the dashboard.

## Dashboard Features

### System Overview

The dashboard provides an at-a-glance view of system health:

- **Active Alerts**: Number of active alerts that require attention
- **System Uptime**: How long the system has been running since the last restart
- **Memory Usage**: Current memory consumption of the application

### Active Alerts

This section displays all active alerts that require attention. Each alert includes:

- **Alert Type**: The type of alert (e.g., Critical Error, Warning)
- **Message**: A description of the issue
- **Occurrences**: How many times this alert has been triggered
- **First Occurred**: When the alert was first triggered
- **Last Notified**: When the alert was last sent to notification channels

Actions:
- **Acknowledge**: Mark an alert as acknowledged (moves it to the resolved state)
- **View Details**: See more context about the alert

### Recent Logs

Displays the most recent log entries from the system, including:

- **Timestamp**: When the log entry was created
- **Level**: Log level (Error, Warning, Info, etc.)
- **Message**: The log message
- **Context**: Additional context data (click to expand)

## Alert Rules

The following alert rules are configured by default:

| Rule ID | Description | Severity | Threshold |
|---------|-------------|----------|-----------|
| `critical_error` | Unhandled exceptions and critical failures | Critical | Immediate |
| `high_error_rate` | High error rate in API endpoints | High | >5% error rate |
| `high_latency` | High response time for API endpoints | High | >2000ms p95 |
| `payment_failed` | Failed payment processing | High | Immediate |
| `warning` | Non-critical issues that may need attention | Warning | Immediate |

## Notification Channels

Alerts are sent to the following channels based on severity:

- **Critical**: Email, SMS, PagerDuty
- **High**: Email, Slack
- **Warning**: Slack only

## Monitoring Endpoints

The following API endpoints are available for monitoring:

- `GET /api/admin/metrics` - Get system metrics and health status
- `GET /api/health` - Basic health check endpoint
- `GET /api/ready` - Readiness check for load balancers

## Troubleshooting

### Common Issues

1. **Can't access the dashboard**
   - Ensure you're logged in with an admin account
   - Check that the `NEXT_PUBLIC_ADMIN_ENABLED` environment variable is set to `true`

2. **Missing logs or metrics**
   - Verify that the logging service is running
   - Check that the `LOG_LEVEL` environment variable is set appropriately

3. **Alerts not being sent**
   - Verify that notification services are properly configured
   - Check the system logs for any errors when sending notifications

## Best Practices

1. **Regular Monitoring**
   - Check the dashboard at least once per day
   - Set up external monitoring for the health endpoints

2. **Alert Management**
   - Acknowledge alerts when addressed
   - Review alert history weekly to identify recurring issues

3. **Performance**
   - Monitor memory usage trends over time
   - Set up alerts for unusual patterns in system metrics

## Security Considerations

- The dashboard should only be accessible over HTTPS
- Use strong, unique passwords for admin accounts
- Regularly review and rotate API keys and credentials
- Monitor access logs for unauthorized access attempts

## Support

For issues with the admin dashboard, please contact the development team with the following information:

- Screenshot of the issue (if applicable)
- Steps to reproduce
- Browser and version
- Any error messages from the browser console

## Changelog

### v1.0.0 (2025-08-13)
- Initial release of the Admin Dashboard
- Basic metrics and alerting
- Log viewer
- Alert management

---

*Last updated: August 13, 2025*
