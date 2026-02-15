# Nameless Analytics | Server-side Client Tag

The Nameless Analytics Server-side Client Tag is a highly customizable GTM custom template designed to claim and enhance requests from [Nameless Analytics Client-side Tracker Tag](https://github.com/nameless-analytics/client-side-tracker-tag/) and other sources.

For an overview of how Nameless Analytics works [start from here](https://github.com/nameless-analytics/nameless-analytics/#high-level-data-flow).

### 🚧 Nameless Analytics and the documentation are currently in beta and subject to change 🚧



## Table of Contents
- [Nameless Analytics Server-side Client Tag UI](#server-side-client-tag-ui)
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
  - [API key for Streaming protocol requests](#api-key-for-streaming-protocol-requests)
    - [Streaming protocol request example](#streaming-protocol-request-example)
- [Google BigQuery settings](#google-bigquery-settings)
  - [Project name](#project-name)
  - [Dataset name](#dataset-name)
  - [Table name](#table-name)
- [Advanced settings](#advanced-settings)
  - [Send data to custom endpoint](#send-data-to-custom-endpoint)
  - [Change user and session cookie prefix](#change-user-and-session-cookie-prefix)
  - [Change default session duration](#change-default-session-duration)
  - [Enable logs in preview mode](#enable-logs-in-preview-mode)
- [Verifying the setup](#verifying-the-setup)
- [Troubleshooting](#troubleshooting)



## Nameless Analytics Server-side Client Tag UI
The Nameless Analytics Server-side Client Tag serves as the secure, high-performance gateway for your data infrastructure. 

It is responsible for validating incoming requests, enriching payloads with Firestore data, and routing verified events to BigQuery and external endpoints.

This is the UI of the Nameless Analytics Server-side Client Tag.

![Nameless Analytics Server-side Client Tag UI](https://github.com/user-attachments/assets/9a36dfd5-1e5d-44d2-85e6-faf5e700ffdb)



## User data
### User parameters
Add, override or remove user parameters in the user_data object. See [Parameter Hierarchy & Overriding](https://github.com/nameless-analytics/nameless-analytics/#parameter-hierarchy--overriding) in the main project documentation.

They will be:
- written in Google Cloud Firestore every time they change --> latest values 
- sent to BigQuery with the last available values --> every values

These user parameters are reserved and can't be modified:
- user_channel_grouping  
- user_source  
- user_tld_source  
- user_campaign  
- user_campaign_id  
- user_campaign_click_id
- user_campaign_content  
- user_campaign_term  
- user_device_type  
- user_country  
- user_city
- user_language  
- user_first_session_timestamp
- user_last_session_timestamp

#### Add/override user level parameters
Add or override parameters at user level. Accepted values: strings, integers, floats, and JSON.

These parameters can override:
- User parameters added in Nameless Analytics Client-side Tracker Configuration Variable

#### Remove user level parameters
Remove user level parameters in user_data object in the payload.

These parameters can remove:
- User parameters added in Nameless Analytics Client-side Tracker Configuration Variable



## Session data
### Session parameters
Add, override or remove session parameters in the session_data object. See [Parameter Hierarchy & Overriding](https://github.com/nameless-analytics/nameless-analytics/#parameter-hierarchy--overriding) in the main project documentation.

They will be:
- written in Google Cloud Firestore every time they change --> latest values 
- sent to BigQuery with the last available values --> every values

These session parameters are reserved and can't be modified:
- user_id
- session_number 
- cross_domain_session 
- session_channel_grouping 
- session_source 
- session_tld_source 
- session_campaign 
- session_campaign_id 
- session_campaign_click_id
- session_campaign_content 
- session_campaign_term 
- session_device_type 
- session_city
- session_country 
- session_language 
- session_hostname 
- session_browser_name 
- session_landing_page_category 
- session_landing_page_location 
- session_landing_page_title 
- session_exit_page_category 
- session_exit_page_location 
- session_exit_page_title 
- session_start_timestamp 
- session_end_timestamp
- total_events
- total_page_views

#### Add/override User ID parameter
Add or override User ID parameter at session level. Accepted values: strings, integers, floats, and JSON.

These parameters can override:
- User ID parameter added in Nameless Analytics Client-side Tracker Configuration Variable

#### Add/override session level parameters
Add or override session level parameters. Accepted values: strings, integers, floats, and JSON.

These parameters can override:
- Session parameters added in Nameless Analytics Client-side Tracker Configuration Variable

#### Remove session level parameters
Remove session level parameters in session_data object in the payload. 

These parameters can remove:
- Session parameters added in Nameless Analytics Client-side Tracker Configuration Variable



## Event data
### Event parameters
Add, override or remove event parameters in the event_data object. See [Parameter Hierarchy & Overriding](https://github.com/nameless-analytics/nameless-analytics/#parameter-hierarchy--overriding) in the main project documentation.

They will be sent to BigQuery with every event.

These event parameters are reserved and can't be modified:
- event_type 
- channel_grouping 
- source 
- campaign 
- campaign_id
- campaign_click_id
- campaign_term 
- campaign_content 
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

#### Add/override event level parameters
Add or overwrite parameters for a specific event. Accepted values: strings, integers, floats, and JSON.

These parameters can override:
- Event parameters added in the Nameless Analytics Client-side Tracker Tag
- Shared event parameters added in the Nameless Analytics Client-side Tracker Configuration Variable
- Event parameters from dataLayer added in the Nameless Analytics Client-side Tracker Tag

#### Remove event level parameters
Remove event level parameters by name in event_data object in the payload. 

These parameters can remove:
- Event parameters added in the Nameless Analytics Client-side Tracker Tag
- Shared event parameters added in the Nameless Analytics Client-side Tracker Configuration Variable
- Event parameters from dataLayer added in the Nameless Analytics Client-side Tracker Tag



## Client settings
### Endpoint path
Endpoint path to which requests have to be sent.


### Accept requests from authorized domains only
Set the specific domains from which requests can be claimed.

If the Server-side Google Tag Manager container needs to claim requests from multiple domains, all those domains must be listed in the "Allowed domains" field. Add one domain per row.


### Reject requests by IP
Reject requests from unauthorized IP addresses. Value accepted IPv4 and IPv6 addresses.


### Enable Bot protection
If enabled, the Nameless Analytics Server-side Client Tag filters requests based on a predefined blacklist of values in the `User-Agent` header:
- **HTTP Libraries:** `curl`, `wget`, `python`, `requests`, `httpie`, `go-http-client`, `java`, `okhttp`, `libwww`, `perl`, `axios`, `node`, `fetch`, `php`, `guzzle`, `ruby`, `faraday`, `rest-client`.
- **AI Agents & LLMs:** `gptbot`, `chatgpt`, `anthropic`, `claude`, `perplexity`, `bytspider`, `ccbot`.
- **SEO & Marketing Bots:** `ahrefs`, `semrush`, `dotbot`, `mj12`, `rogerbot`, `bot`, `crawler`, `spider`, `scraper`.
- **Automation & Security:** `nmap`, `zgrab`, `masscan`, `shodan`, `headless`, `phantomjs`, `selenium`, `puppeteer`, `playwright`, `cypress`, `electron`.

Requests with a missing or empty `User-Agent` header are also automatically rejected.


### API key for Streaming protocol requests
Secure the Streaming protocol (Measurement Protocol) endpoint by requiring a secret API key.

When the **"Add API key for Streaming protocol"** checkbox is enabled, the Client Tag will reject any request where the `event_origin` is set to `Streaming protocol` unless it includes a valid `x-api-key` header matching the configured value.

Requests with `event_origin` set to `Website` are not affected by this setting, ensuring seamless browser tracking without the need for additional headers or CORS preflight requests.

The [Nameless Analytics Streaming Protocol](https://github.com/nameless-analytics/nameless-analytics/tree/main/streaming-protocol) allows you to send data from your backend directly to the Nameless Analytics Server-side Client Tag endpoint. 



## Google BigQuery settings
### Project name
The unique ID of the Google Cloud Project.


### Dataset name
The ID of the BigQuery dataset where Nameless Analytics will store its tables. This dataset must be created before the tag can write data.


### Table name
The name of the main raw events table. By default, this is set to `events_raw`. Create it using the Create tables DML query in the [Create tables](https://github.com/nameless-analytics/nameless-analytics/blob/main/tables/TABLES.md#create-tables) section before start sending events.



## Advanced settings
### Send data to custom endpoint
Send POST requests to custom endpoint with the same data loaded into Google BigQuery. 


### Change user and session cookie prefix
Change the user and session cookie prefix. Default prefix: na_u and na_s. See [Cookie section](https://github.com/nameless-analytics/nameless-analytics/#cookies) for more information.


### Change default session duration
Change the session duration in minutes. Default value: 30 min.


### Enable logs in preview mode
Enable logs for all events in preview mode. If cross-domain is enabled, all domains will send events in relative preview mode. For more information, see the [Cross-domain section](https://github.com/nameless-analytics/client-side-tracker-configuration-variable/#enable-cross-domain-tracking).



## Verifying the setup
When logs are enabled in the [Advanced settings](#enable-logs-in-preview-mode), you can verify that the tag is processing events correctly by checking the GTM Server Preview mode logs.

The following success messages indicate a correct implementation and data delivery:

| **Scope** | **Message** | **Description** |
|:---|:---|:---|
| Data validation | 🟢 Request correct | The incoming request passed all validation checks |
| | 🟢 Request correct, user and session cookie found. Cross-domain link decoration will be applied | Success log for `get_user_data` cross-domain requests |
| | 🟢 Request claimed successfully | Default success message for a fully processed event |
| Data storage | 🟢 User successfully created in Firestore, session successfully added into Firestore | Confirmation that a new user and their first session were persisted |
| | 🟢 User already in Firestore, session successfully added into Firestore | Confirmation that a new session was added to an existing user |
| | 🟢 User already in Firestore, session successfully updated into Firestore | Confirmation that an existing session was refreshed |
| | 🟢 Payload data inserted successfully into BigQuery | Confirmation that the event was pushed to BigQuery |
| | 🟢 Request sent successfully to: [URL] | Forwarded successfully to a custom endpoint |


## Troubleshooting
If you encounter any issues or see 🔴 error messages in the console, please refer to the [Troubleshooting Guide](https://github.com/nameless-analytics/nameless-analytics/blob/main/setup-guides/TROUBLESHOOTING.md).

---

Reach me at: [Email](mailto:hello@namelessanalytics.com) | [Website](https://namelessanalytics.com/?utm_source=github.com&utm_medium=referral&utm_campaign=nameless_analytics_server_side_client_tag_readme) | [Twitter](https://x.com/nmlssanalytics) | [LinkedIn](https://www.linkedin.com/company/nameless-analytics/)
