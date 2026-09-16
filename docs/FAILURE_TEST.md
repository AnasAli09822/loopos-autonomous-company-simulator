# Failure Test — Sales Runaway

## Failure injected

Sales behaves badly **within its legitimate role authority**. There is no hidden bypass switch. The Sales role simply closes seven high-probability deals rapidly, creating more commitments than base operating capacity can absorb.

## Observed shared-state pressure

- Sales actions: `7 closes`
- Bookings: `$21,336`
- Backlog: `7`
- Base capacity: `2`

## Compensation by other roles

Operations reads the same backlog and:

- enables Sales throttle
- requests 4 flex-capacity units for `$1,600`

Finance reads the request, cash position, Sales velocity, bookings, and backlog and:

- approves the bounded `$1,600` spend because the reserve remains safe
- detects the commercial control breach
- sets `sales_suspended = true`
- opens a Human Inbox control review

Operations then:

- activates the approved 4 units
- fulfills 6 orders
- reduces backlog `7 → 1`

Service pressure still has a consequence: actual customer churn moves `0 → 1`.

## Why this is a meaningful failure test

The other roles do not magically erase the failure. They reduce its blast radius, enforce a commercial boundary, and leave the unresolved judgment with a human. The system records both the recovery and the residual damage.
