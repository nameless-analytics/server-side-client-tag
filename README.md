# Nameless Analytics | Server-side Client Tag

The Nameless Analytics Server-side Client Tag claims and validates requests from the [Nameless Analytics Client-side Tracker Tag](https://github.com/nameless-analytics/client-side-tracker-tag/) and the [Streaming Protocol](https://github.com/nameless-analytics/nameless-analytics/tree/main/streaming-protocol), enriches them with user and session data, writes events to Firestore and BigQuery, and can forward them to an external endpoint.

For an overview of how Nameless Analytics works [start from here](https://github.com/nameless-analytics/nameless-analytics/#overview).


### 🚧 Nameless Analytics and the documentation are currently in beta and subject to change


## Table of Contents

- [Template interface](#template-interface)
- [User data](#user-data)
  - [User parameters](#user-parameters)
    - [Add/override user level parameters](#addoverride-user-level-parameters)
    - [Remove user level parameters](#remove-user-level-parameters)
- [Session data](#session-data)
  - [Session parameters](#session-parameters)
    - [Add/override User ID parameter](#addoverride-user-id-parameter)
    - [Add/override session level parameters](#addoverride-session-level-parameters)
    - [Remove session level parameters](#remove-session-level-parameters)
- [Event data](#event-data)
  - [Event parameters](#event-parameters)
    - [Add/override event level parameters](#addoverride-event-level-parameters)
    - [Remove event level parameters](#remove-event-level-parameters)
- [Client settings](#client-settings)
  - [Endpoint path](#endpoint-path)
  - [Accept requests from authorized domains only](#accept-requests-from-authorized-domains-only)
  - [Reject requests by IP](#reject-requests-by-ip)
  - [Enable Bot protection](#enable-bot-protection)
  - [Request body validation](#request-body-validation)
  - [Cross-domain ID validation](#cross-domain-id-validation)
  - [API key for Streaming Protocol requests](#api-key-for-streaming-protocol-requests)
- [Google BigQuery settings](#google-bigquery-settings)
  - [Google BigQuery project ID](#google-bigquery-project-id)
  - [Google BigQuery dataset ID](#google-bigquery-dataset-id)
  - [Google BigQuery table ID](#google-bigquery-table-id)
- [Session settings](#session-settings)
  - [Change user and session cookie prefix](#change-user-and-session-cookie-prefix)
  - [Change default session duration](#change-default-session-duration)
- [Advanced settings](#advanced-settings)
  - [Send data to custom endpoint](#send-data-to-custom-endpoint)
  - [Enable logs in debug view](#enable-logs-in-debug-view)
- [Verifying the setup](#verifying-the-setup)



## Template interface
Use the template to configure server-side parameter changes, request security, storage, session cookies, external forwarding and debug logs.

![Nameless Analytics Server-side Client Tag UI](https://github.com/user-attachments/assets/0ae82d69-d89d-43ad-97cf-64330af205ed)



## User data
### User parameters
Custom user parameters are received in `user_data` and persisted with the user. Accepted values are strings, integers, floats, booleans and JSON-compatible values.

Firestore keeps the latest stored value for each user, while BigQuery preserves the value attached to each enriched event. Server-side additions and removals are applied after the Client-side Tracker Configuration Variable. See [Parameter hierarchy](https://github.com/nameless-analytics/nameless-analytics/#parameter-hierarchy).

> [!WARNING]
> Custom user parameters increase the size of the Firestore user document. See [Firestore 1 MiB document limit](https://github.com/nameless-analytics/nameless-analytics/blob/main/setup-guides/TROUBLESHOOTING-GUIDE.md#firestore-1-mib-document-limit).

<details><summary>Reserved user parameters</summary>

These user parameters are reserved and can't be modified:
- user_date
- client_id
- sessions
- user_channel_grouping
- user_source
- user_tld_source
- user_campaign
- user_campaign_id
- user_campaign_click_id
- user_campaign_content
- user_medium
- user_campaign_term
- user_device_type
- user_country
- user_city
- user_language
- user_first_session_timestamp
- user_last_session_timestamp

</details>

#### Add/override user level parameters
Add custom fields to every tracked event, one row per field with **Param name** and **Param value**. A matching field received from the Client-side Tracker Configuration Variable is replaced before Firestore enrichment.

#### Remove user level parameters
Remove matching custom fields from the incoming `user_data` object after server-side additions are applied. The table takes **Param name** only.

This option does not currently delete a value already stored in Firestore. For an existing user, the stored value can therefore be added back to the enriched event.



## Session data
### Session parameters
Custom session parameters are received in `session_data` and persisted with the session. Accepted values are strings, integers, floats, booleans and JSON-compatible values.

Firestore keeps the latest stored value for the session, while BigQuery preserves the value attached to each enriched event. Server-side additions and removals are applied after the Client-side Tracker Configuration Variable. See [Parameter hierarchy](https://github.com/nameless-analytics/nameless-analytics/#parameter-hierarchy).

> [!WARNING]
> Custom session parameters increase the size of the Firestore user document. See [Firestore 1 MiB document limit](https://github.com/nameless-analytics/nameless-analytics/blob/main/setup-guides/TROUBLESHOOTING-GUIDE.md#firestore-1-mib-document-limit).

<details><summary>Reserved session parameters</summary>

These session parameters are reserved and can't be modified:
- session_date
- session_id
- user_id
- session_number
- cross_domain_session
- session_channel_grouping
- session_source
- session_tld_source
- session_campaign
- session_campaign_id
- session_campaign_click_id
- session_campaign_term
- session_campaign_content
- session_medium
- session_device_type
- session_country
- session_city
- session_language
- session_hostname
- session_browser_name
- session_landing_page_category
- session_landing_page_url
- session_landing_page_path
- session_landing_page_title
- session_exit_page_category
- session_exit_page_url
- session_exit_page_path
- session_exit_page_title
- session_start_timestamp
- session_end_timestamp

</details>

#### Add/override User ID parameter
Provide the optional `user_id` at session level. An existing non-null session value remains unchanged during normal events; use `login` to replace it and `logout` to clear it. See [User ID lifecycle](https://github.com/nameless-analytics/nameless-analytics/#user-id-lifecycle).

#### Add/override session level parameters
Add custom fields to every tracked event. A matching field received from the Client-side Tracker Configuration Variable is replaced before Firestore enrichment.

#### Remove session level parameters
Remove matching custom fields from the incoming `session_data` object after server-side additions are applied.

This option does not currently delete a value already stored in Firestore. For an existing session, the stored value can therefore be added back to the enriched event.



## Event data
### Event parameters
Custom event parameters are received in `event_data` and written to BigQuery with the event. Accepted values are strings, integers, floats, booleans and JSON-compatible values.

The browser resolves `dataLayer`, Configuration Variable and Client-side Tracker Tag values first. The Server-side Client Tag then applies its additions or overrides followed by its removals. See [Parameter hierarchy](https://github.com/nameless-analytics/nameless-analytics/#parameter-hierarchy).

<details><summary>Reserved event parameters</summary>

These event parameters are reserved and can't be modified:
- event_type
- channel_grouping
- source
- campaign
- campaign_id
- campaign_click_id
- campaign_term
- campaign_content
- medium
- user_agent
- browser_name
- browser_language
- browser_version
- device_type
- device_vendor
- device_model
- os_name
- os_version
- screen_size
- viewport_size
- tld_source
- city
- country
- cross_domain_id

</details>

#### Add/override event level parameters
Add custom fields to every tracked event. A matching browser-side value is replaced before the event is stored.

#### Remove event level parameters
Remove custom fields before storage. Removal runs after server-side additions, so a field present in both lists is removed.



## Client settings
### Endpoint path
Enter the dedicated request path beginning with `/` and without a trailing slash. It must exactly match the [Endpoint path](https://github.com/nameless-analytics/client-side-tracker-configuration-variable/#endpoint-path) in the Client-side Tracker Configuration Variable.

The client claims only requests whose path matches this value. Avoid using a path claimed by another client in the same server container.

### Accept requests from authorized domains only
Grouped under **Security rules**. Restrict requests to the domains listed under **Authorized domains**. This option is off by default, so every origin is accepted until it is enabled; enable it for production containers.

Enter bare domain names without protocol, path or trailing slash. The comparison uses the registrable domain, so one entry covers its subdomains. Include every production, staging and cross-domain participant.

When filtering is enabled, requests without an `Origin` header are rejected. Browser tracking supplies it automatically; Streaming Protocol and other backend implementations must set it explicitly. Because callers can reproduce an `Origin` header, this setting is an origin filter rather than authentication.

### Reject requests by IP
Reject requests whose source address exactly matches an entry in **Banned IPs**. Add one IPv4 or IPv6 address per row under **Internet Protocol address**.

Use an edge rate limiter or WAF for broader traffic control; this list is intended for known addresses.

### Enable Bot protection
Reject requests when the `User-Agent` contains one of the built-in signatures. Matching is case-insensitive and can produce false positives, so verify legitimate automated integrations before enabling it.

<details><summary>Built-in User-Agent signatures</summary>

- **HTTP Libraries:** `curl`, `wget`, `python`, `requests`, `httpie`, `go-http-client`, `java`, `okhttp`, `libwww`, `perl`, `axios`, `node`, `fetch`, `php`, `guzzle`, `ruby`, `faraday`, `rest-client`.
- **AI Agents & LLMs:** `gptbot`, `chatgpt`, `anthropic`, `claude`, `perplexity`, `bytespider`, `ccbot`.
- **SEO & Marketing Bots:** `ahrefs`, `semrush`, `dotbot`, `mj12`, `rogerbot`, `bot`, `crawler`, `spider`, `scraper`.
- **Automation & Security:** `nmap`, `zgrab`, `masscan`, `shodan`, `headless`, `phantomjs`, `selenium`, `puppeteer`, `playwright`, `cypress`, `electron`.

</details>

Two further `User-Agent` checks are always active, even when general bot protection is disabled:

- a missing or empty value is rejected;
- Streaming Protocol requests must use exactly `Nameless Analytics - Streaming Protocol`.

### Request body validation
The endpoint accepts `POST` requests containing a valid JSON object. Before storage, the client validates the payload structure, required fields, value types, dates and identifier formats. Unsupported top-level fields are not accepted.

The Client-side Tracker Tag builds the website payload automatically. Backend implementations should follow the [Streaming Protocol request requirements](https://github.com/nameless-analytics/nameless-analytics/blob/main/streaming-protocol/STREAMING-PROTOCOL.md#request-requirements). Except for the `get_user_data` handshake, a website `page_view` must create the user and session before later events can use them.

### Cross-domain ID validation
The client accepts `cross_domain_id` only when it follows the server-issued session ID format: two groups of 15 alphanumeric characters separated by an underscore.

An invalid value is ignored without rejecting the event. The request continues with the destination's local cookies when available; otherwise the normal new-user or new-session logic applies. No configuration is required. See [Cross-domain architecture](https://github.com/nameless-analytics/nameless-analytics/#cross-domain-architecture).

### API key for Streaming Protocol requests
Enable **Add API key for Streaming Protocol** and enter a secret value before sending backend events. Every request declaring `event_origin: "Streaming Protocol"` must provide the same value in the `X-Api-Key` header and use the required `User-Agent`.

Website requests do not require this header. Authorized-origin filtering still applies when enabled. Keep the API key on the server and see the [Streaming Protocol documentation](https://github.com/nameless-analytics/nameless-analytics/tree/main/streaming-protocol) for the complete request format.



## Google BigQuery settings
### Google BigQuery project ID
Enter the Google Cloud project used for both BigQuery and the Nameless Analytics Firestore database.

### Google BigQuery dataset ID
Enter the existing BigQuery dataset where raw events are stored.

### Google BigQuery table ID
Enter the raw events table created through [Create raw tables](https://github.com/nameless-analytics/nameless-analytics/blob/main/tables/TABLES.md#create-raw-tables).

The provided setup and reporting functions expect `events_raw`. Use another name only if you also update the dependent queries. All three BigQuery fields are required.



## Session settings
### Change user and session cookie prefix
The default cookie names are `na_u` and `na_s`. When this option is enabled, the value in **Cookie prefix** is prepended to both names: `brand` produces `brand_na_u` and `brand_na_s`.

Changing the prefix prevents the client from reading cookies created under the previous names, so returning browsers are treated as new until the new cookies exist. See [Server-side cookies](https://github.com/nameless-analytics/nameless-analytics/#server-side-cookies).

### Change default session duration
The session cookie expires after 30 minutes by default and is refreshed as website events are processed. Enable this option and set **Session duration** in minutes to use another positive value.



## Advanced settings
### Send data to custom endpoint
After Firestore and BigQuery succeed, send the enriched, unencoded event as a JSON `POST` request to the HTTPS URL in **Full endpoint domain path**. The request includes `Content-Type: application/json` by default.

Enable **Add custom request headers** to configure authentication or other headers under **Custom request headers**, a table of **Header name** and **Header value** pairs. Each header name is required and must be unique. These values are not sent to the browser, but remain visible to authorized GTM editors and in container exports.

A forwarding failure does not roll back Firestore or BigQuery. Check `processing.custom_endpoint` in the response to confirm whether delivery succeeded.

### Enable logs in debug view
Print processing details in GTM Server Preview. **Disabled by default.** Enable it while validating or diagnosing the implementation.



## Verifying the setup
Enable logs, start GTM Server Preview and load a page where the Client-side Tracker Tag sends `page_view`.

For a successfully processed event, the JSON response contains `status_code`, `response`, `processing` and `data`, where `data` is the complete server-side enriched payload.

| Check | Expected result |
|:---|:---|
| Configuration | `CLIENT TAG CONFIGURATION` shows the expected endpoint and security settings. |
| Request | The client identifies a `Website` request and a valid `page_view`. |
| Identity | The cookie check reports the expected new or returning user and session state. |
| Firestore | The user and session are created, added or updated successfully. |
| BigQuery | The enriched payload is inserted successfully. |
| Custom endpoint | `custom_endpoint` is `success`, or `skipped` when forwarding is disabled. |
| Response | HTTP status is `200`; `claim_request`, `firestore` and `bigquery` are `success`. |
| Final status | The debug log ends with `🟢 Request processed successfully`. |

For cross-domain tracking, a valid `get_user_data` request returns the current identifiers with `firestore`, `bigquery` and `custom_endpoint` marked as `skipped`. For Streaming Protocol, also confirm the request type, `User-Agent`, API key and existing user/session context.

If a stage is missing, a processing value is not successful or the request is refused, use the [Troubleshooting Guide](https://github.com/nameless-analytics/nameless-analytics/blob/main/setup-guides/TROUBLESHOOTING-GUIDE.md).

#

[Website](https://namelessanalytics.com/?utm_source=github.com&utm_medium=referral&utm_campaign=nameless_analytics_server_side_client_tag_readme) | [Twitter](https://x.com/nmlssanalytics) | [LinkedIn](https://www.linkedin.com/company/nameless-analytics/)
