// --------------------------------------------------------------------------------------------------------------
// NAMELESS ANALYTICS | SERVER SIDE | CLIENT TAG
// This client tag template is used to receive and process requests from the Nameless Analytics Client-Side Tracker Tag.
// --------------------------------------------------------------------------------------------------------------

// --------------------------------------------------------------------------------------------------------------
// LIBRARIES
// --------------------------------------------------------------------------------------------------------------

const log = require('logToConsole');
const getTimestampMillis = require('getTimestampMillis');
const claimRequest = require('claimRequest');
const getRequestHeader = require('getRequestHeader');
const getRemoteAddress = require('getRemoteAddress');
const getRequestBody = require('getRequestBody');
const getRequestMethod = require('getRequestMethod');
const getRequestPath = require('getRequestPath');
const getClientName = require('getClientName');
const setResponseHeader = require('setResponseHeader');
const setResponseBody = require('setResponseBody');
const setResponseStatus = require('setResponseStatus');
const returnResponse = require('returnResponse');
const runContainer = require('runContainer');
const JSON = require('JSON');
const Object = require('Object');
const getType = require('getType');
const makeNumber = require('makeNumber');
const generateRandom = require('generateRandom');
const getContainerVersion = require('getContainerVersion');
const getCookieValues = require('getCookieValues');
const setCookie = require('setCookie');
const computeEffectiveTldPlusOne = require('computeEffectiveTldPlusOne');
const BigQuery = require('BigQuery');
const Firestore = require('Firestore');
const sendHttpRequest = require('sendHttpRequest');
const createRegex = require('createRegex');
const testRegex = require('testRegex');


// --------------------------------------------------------------------------------------------------------------
// CONSTANTS
// --------------------------------------------------------------------------------------------------------------

// Check request endpoint 
const endpoint = data.endpoint;
const request_path = getRequestPath();

if (request_path !== endpoint) {
  return;
}


// Request data
const request_origin = getRequestHeader('Origin');
const request_ip = getRemoteAddress();
const request_method = getRequestMethod();
var message;
var status_code;


if (request_method !== 'POST') {
  return_method_not_allowed_response();
  return;
}


// Event data
const event_data = JSON.parse(getRequestBody());

if (getType(event_data) !== 'object') {
  return_invalid_json_response();
  return;
}

const payload_schema_errors = validate_payload_schema(event_data);

if (payload_schema_errors.length > 0) {
  return_invalid_payload_schema_response(payload_schema_errors);
  return;
}

const event_data_obj = event_data.event_data || {};
const event_api_key = getRequestHeader('X-Api-Key'); // For Streaming Protocol 
const api_key = data.api_key; // For Streaming Protocol

const page_date = event_data.page_date;
const page_id = event_data.page_id;
const page_data_obj = event_data.page_data;
const event_origin = event_data.event_origin;
const event_date = event_data.event_date;
const event_timestamp = event_data.event_timestamp;
const event_name = event_data.event_name;
const event_id = event_data.event_id;
event_data.user_data = event_data.user_data || {};
event_data.session_data = event_data.session_data || {};
event_data.gtm_data = event_data.gtm_data || {};
if (event_data.event_data) {
  // Optional in the payload: sources that do not send it, such as the Streaming Protocol, have none
  if (event_data.event_data.medium === undefined) { event_data.event_data.medium = null; }
  event_data.event_data.channel_grouping = get_channel_grouping(event_data_obj.source, event_data_obj.medium, event_data_obj.campaign, event_data_obj.campaign_click_id);
}


// Cookie values
const user_cookie_name = (data.change_cookie_prefix) ? data.cookie_prefix + '_na_u' : 'na_u';
const user_cookie_value = getCookieValues(user_cookie_name)[0];

const session_cookie_name = (data.change_cookie_prefix) ? data.cookie_prefix + '_na_s' : 'na_s';
const session_cookie_value = getCookieValues(session_cookie_name)[0];


// Validate cookie format
function validate_user_cookie(cookie) {
  if (!cookie) return true;
  const pattern = createRegex('^[A-Za-z0-9]{15}$');
  return testRegex(pattern, cookie);
}

function validate_session_cookie(cookie) {
  if (!cookie) return true;
  const pattern = createRegex('^[A-Za-z0-9]{15}_[A-Za-z0-9]{15}-[A-Za-z0-9]{15}$');
  return testRegex(pattern, cookie);
}

// Validate cross-domain ID format (session_id: 15 char + _ + 15 char)
function validate_cross_domain_id(id) {
  if (!id) return false;
  const pattern = createRegex('^[A-Za-z0-9]{15}_[A-Za-z0-9]{15}$');
  return testRegex(pattern, id);
}


// Validate payload schema before deriving values or writing data
function validate_payload_schema(payload) {
  const errors = [];
  const is_get_user_data = payload.event_name === 'get_user_data';
  const allowed_fields = (is_get_user_data) ?
    ['event_name', 'event_origin'] :
    ['user_data', 'session_data', 'page_date', 'page_id', 'page_data', 'event_date', 'event_timestamp', 'event_id', 'event_name', 'event_origin', 'event_data', 'datalayer', 'ecommerce', 'gtm_data', 'consent_data'];

  Object.keys(payload).forEach((key) => {
    if (allowed_fields.indexOf(key) === -1) {
      errors.push('unsupported top-level parameter "' + key + '"');
    }
  });

  if (is_get_user_data) {
    if (getType(payload.event_origin) !== 'string') {
      errors.push('event_origin must be a string');
    } else if (payload.event_origin !== 'Website' && payload.event_origin !== 'Streaming Protocol') {
      errors.push('event_origin must be Website or Streaming Protocol');
    }

    return errors;
  }

  if (getType(payload.page_date) === 'undefined' || getType(payload.page_date) === 'null') {
    errors.push('page_date is required');
  } else if (!validate_iso_date(payload.page_date)) {
    errors.push('page_date must be a valid date in YYYY-MM-DD format');
  }

  const valid_page_id = validate_partial_page_id(payload.page_id);
  if (getType(payload.page_id) === 'undefined' || getType(payload.page_id) === 'null') {
    errors.push('page_id is required');
  } else if (!valid_page_id) {
    errors.push('page_id must be a 15-character alphanumeric string');
  }

  if (getType(payload.page_data) === 'undefined' || getType(payload.page_data) === 'null') {
    errors.push('page_data is required');
  } else if (getType(payload.page_data) !== 'object' || Object.keys(payload.page_data).length === 0) {
    errors.push('page_data must be a non-empty object');
  } else {
    validate_required_nullable_string(payload.page_data, 'page_title', errors);
    validate_required_string(payload.page_data, 'page_hostname', errors);
    validate_required_nullable_string(payload.page_data, 'page_url', errors);
    validate_required_nullable_string(payload.page_data, 'page_path', errors);
    validate_required_positive_integer(payload.page_data, 'page_load_timestamp', errors);
  }

  if (getType(payload.event_date) === 'undefined' || getType(payload.event_date) === 'null') {
    errors.push('event_date is required');
  } else if (!validate_iso_date(payload.event_date)) {
    errors.push('event_date must be a valid date in YYYY-MM-DD format');
  }

  if (getType(payload.event_timestamp) === 'undefined' || getType(payload.event_timestamp) === 'null') {
    errors.push('event_timestamp is required');
  } else if (getType(payload.event_timestamp) !== 'number' || payload.event_timestamp <= 0 || payload.event_timestamp % 1 !== 0) {
    errors.push('event_timestamp must be a positive integer');
  }

  const valid_event_id = validate_partial_event_id(payload.event_id);
  if (getType(payload.event_id) === 'undefined' || getType(payload.event_id) === 'null') {
    errors.push('event_id is required');
  } else if (!valid_event_id) {
    errors.push('event_id must contain two 15-character alphanumeric segments separated by an underscore');
  } else if (valid_page_id && payload.event_id.indexOf(payload.page_id + '_') !== 0) {
    errors.push('event_id must start with page_id followed by an underscore');
  }

  if (getType(payload.event_name) === 'undefined' || getType(payload.event_name) === 'null') {
    errors.push('event_name is required');
  } else if (getType(payload.event_name) !== 'string' || payload.event_name.length === 0) {
    errors.push('event_name must be a non-empty string');
  }

  if (getType(payload.event_origin) === 'undefined' || getType(payload.event_origin) === 'null') {
    errors.push('event_origin is required');
  } else if (getType(payload.event_origin) !== 'string') {
    errors.push('event_origin must be a string');
  } else if (payload.event_origin !== 'Website' && payload.event_origin !== 'Streaming Protocol') {
    errors.push('event_origin must be Website or Streaming Protocol');
  }

  const valid_event_data = getType(payload.event_data) === 'object' && Object.keys(payload.event_data).length > 0;
  if (getType(payload.event_data) === 'undefined' || getType(payload.event_data) === 'null') {
    errors.push('event_data is required');
  } else if (!valid_event_data) {
    errors.push('event_data must be a non-empty object');
  } else if (getType(payload.event_data.event_type) === 'undefined' || getType(payload.event_data.event_type) === 'null') {
    errors.push('event_data.event_type is required');
  } else if (getType(payload.event_data.event_type) !== 'string') {
    errors.push('event_data.event_type must be a string');
  } else if (payload.event_name === 'page_view' && payload.event_data.event_type !== 'page_view') {
    errors.push('event_data.event_type must be page_view when event_name is page_view');
  } else if (payload.event_name !== 'page_view' && payload.event_data.event_type !== 'event') {
    errors.push('event_data.event_type must be event when event_name is not page_view');
  }

  if (valid_event_data) {
    validate_required_nullable_string(payload.event_data, 'source', errors);
    validate_required_nullable_string(payload.event_data, 'campaign', errors);
    validate_required_nullable_string(payload.event_data, 'campaign_id', errors);
    validate_required_nullable_string(payload.event_data, 'campaign_click_id', errors);
    validate_required_nullable_string(payload.event_data, 'campaign_term', errors);
    validate_required_nullable_string(payload.event_data, 'campaign_content', errors);
    validate_optional_nullable_string(payload.event_data, 'medium', errors);
  }

  validate_optional_object(payload, 'user_data', errors);
  validate_optional_object(payload, 'session_data', errors);
  validate_optional_object(payload, 'gtm_data', errors);
  validate_optional_object(payload, 'consent_data', errors);

  validate_consent_data_values(payload.consent_data, errors);
  validate_gtm_data_values(payload.gtm_data, errors);

  if (getType(payload.consent_data) === 'object' && Object.keys(payload.consent_data).length === 0) {
    errors.push('consent_data must be a non-empty object or null');
  }

  if (getType(payload.datalayer) !== 'undefined' && getType(payload.datalayer) !== 'null' && getType(payload.datalayer) !== 'array') {
    errors.push('datalayer must be an array or null');
  }

  if (getType(payload.ecommerce) !== 'undefined' && getType(payload.ecommerce) !== 'null' && getType(payload.ecommerce) !== 'object') {
    errors.push('ecommerce must be an object or null');
  }

  return errors;
}


function validate_optional_object(payload, key, errors) {
  const value_type = getType(payload[key]);

  if (value_type !== 'undefined' && value_type !== 'null' && value_type !== 'object') {
    errors.push(key + ' must be an object or null');
  }
}


function validate_consent_data_values(consent_data, errors) {
  if (getType(consent_data) !== 'object') { return; }

  Object.keys(consent_data).forEach((key) => {
    const value_type = getType(consent_data[key]);

    if (value_type !== 'string' && value_type !== 'null') {
      errors.push('consent_data.' + key + ' must be a string or null');
    }
  });
}


function validate_gtm_data_values(gtm_data, errors) {
  if (getType(gtm_data) !== 'object') { return; }

  Object.keys(gtm_data).forEach((key) => {
    const value = gtm_data[key];
    const value_type = getType(value);

    if (value_type !== 'string' && value_type !== 'null' && (value_type !== 'number' || value % 1 !== 0)) {
      errors.push('gtm_data.' + key + ' must be a string, integer or null');
    }
  });
}


function validate_reserved_parameters(payload) {
  const errors = [];
  const reserved_user_parameters = [
    'user_date',
    'client_id',
    'sessions',
    'user_channel_grouping',
    'user_source',
    'user_tld_source',
    'user_campaign',
    'user_campaign_id',
    'user_campaign_click_id',
    'user_campaign_term',
    'user_campaign_content',
    'user_medium',
    'user_device_type',
    'user_country',
    'user_city',
    'user_language',
    'user_first_session_timestamp',
    'user_last_session_timestamp'
  ];
  const reserved_session_parameters = [
    'session_date',
    'session_id',
    'session_number',
    'cross_domain_session',
    'session_channel_grouping',
    'session_source',
    'session_tld_source',
    'session_campaign',
    'session_campaign_id',
    'session_campaign_click_id',
    'session_campaign_term',
    'session_campaign_content',
    'session_medium',
    'session_device_type',
    'session_country',
    'session_city',
    'session_language',
    'session_hostname',
    'session_browser_name',
    'session_landing_page_category',
    'session_landing_page_url',
    'session_landing_page_path',
    'session_landing_page_title',
    'session_exit_page_category',
    'session_exit_page_url',
    'session_exit_page_path',
    'session_exit_page_title',
    'session_start_timestamp',
    'session_end_timestamp'
  ];

  Object.keys(payload.user_data || {}).forEach((key) => {
    if (reserved_user_parameters.indexOf(key) !== -1) {
      errors.push('user_data.' + key + ' is reserved');
    }
  });

  Object.keys(payload.session_data || {}).forEach((key) => {
    if (reserved_session_parameters.indexOf(key) !== -1) {
      errors.push('session_data.' + key + ' is reserved');
    }
  });

  return errors;
}


function validate_required_string(container, key, errors) {
  const value_type = getType(container[key]);

  if (value_type === 'undefined') {
    errors.push(key + ' is required');
  } else if (value_type !== 'string' || container[key].length === 0) {
    errors.push(key + ' must be a non-empty string');
  }
}


function validate_required_nullable_string(container, key, errors) {
  const value_type = getType(container[key]);

  if (value_type === 'undefined') {
    errors.push(key + ' is required');
  } else if (value_type !== 'string' && value_type !== 'null') {
    errors.push(key + ' must be a string or null');
  }
}


function validate_optional_nullable_string(container, key, errors) {
  const value_type = getType(container[key]);

  if (value_type !== 'undefined' && value_type !== 'string' && value_type !== 'null') {
    errors.push(key + ' must be a string or null');
  }
}


function validate_required_positive_integer(container, key, errors) {
  const value = container[key];
  const value_type = getType(value);

  if (value_type === 'undefined' || value_type === 'null') {
    errors.push(key + ' is required');
  } else if (value_type !== 'number' || value <= 0 || value % 1 !== 0) {
    errors.push(key + ' must be a positive integer');
  }
}


function validate_iso_date(value) {
  if (getType(value) !== 'string') return false;

  const pattern = createRegex('^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$');
  if (!testRegex(pattern, value)) return false;

  const parts = value.split('-');
  const year = makeNumber(parts[0]);
  const month = makeNumber(parts[1]);
  const day = makeNumber(parts[2]);
  const days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const leap_year = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

  if (leap_year) days_in_month[1] = 29;

  return year >= 1 && day <= days_in_month[month - 1];
}


function validate_partial_page_id(id) {
  if (getType(id) !== 'string') return false;
  const pattern = createRegex('^[A-Za-z0-9]{15}$');
  return testRegex(pattern, id);
}


function validate_partial_event_id(id) {
  if (getType(id) !== 'string') return false;
  const pattern = createRegex('^[A-Za-z0-9]{15}_[A-Za-z0-9]{15}$');
  return testRegex(pattern, id);
}


// --------------------------------------------------------------------------------------------------------------
// CHECK REQUESTS
// --------------------------------------------------------------------------------------------------------------

// Check request endpoint
if (data.enable_logs) { log('NAMELESS ANALYTICS'); }
if (data.enable_logs) { log('CLIENT TAG CONFIGURATION'); }
log_client_tag_configuration();

// Check request origin, required fields and claim requests
if (check_origin()) {
  if (!check_ip()) {

    if (data.enable_logs) { log('CHECKING REQUEST'); }

    if (event_name === 'get_user_data') {
      if (data.enable_logs) { log('👉 Request type: Get user data'); }
    } else {
      if (data.enable_logs) { log('👉 Request type:', event_origin); }
    }

    if (data.enable_logs) { log('👉 Event name: ', event_data.event_name); }

    if (request_method === 'POST') {
      // REFUSE REQUESTS
      // Check if user or session cookie is missing for get_user_data requests
      if (event_name === 'get_user_data' && (user_cookie_value === undefined || session_cookie_value === undefined)) {
        if (data.enable_logs) { log('👉 Request from get_user_data event'); }

        if (data.enable_logs) { log('CHECKING COOKIES'); }

        if (user_cookie_value === undefined) {
          message = '🔴 User cookie not found. No cross-domain URL decoration will be applied';
          status_code = 400;

          claim_request(set_ids_get_user_data(), status_code, message);
          return;
        } else if (session_cookie_value === undefined) {
          message = '🔴 Session cookie not found. No cross-domain URL decoration will be applied';
          status_code = 400;

          claim_request(set_ids_get_user_data(), status_code, message);
          return;
        }
      }

      // Check User-Agent header (Bot detection)
      const request_user_agent = (getRequestHeader('User-Agent') || '').toLowerCase();

      if (!request_user_agent) {
        message = '🔴 Missing User-Agent header. Request from bot';
        status_code = 403;

        claim_request({ event_name: event_name }, status_code, message);
        return;
      }

      if (event_origin === 'Streaming Protocol' && request_user_agent !== 'nameless analytics - streaming protocol') {
        message = '🔴 Invalid User-Agent header value. Request from bot';
        status_code = 403;

        claim_request({ event_name: event_name }, status_code, message);
        return;
      }

      if (data.enable_bot_protection) {
        const bad_agents = ["curl", "wget", "python", "requests", "httpie", "go-http-client", "java", "okhttp", "libwww", "perl", "axios", "node", "fetch", "php", "guzzle", "ruby", "faraday", "rest-client", "gptbot", "chatgpt", "anthropic", "claude", "perplexity", "bytespider", "ccbot", "ahrefs", "semrush", "dotbot", "mj12", "rogerbot", "nmap", "zgrab", "masscan", "shodan", "bot", "crawler", "spider", "scraper", "headless", "phantomjs", "selenium", "puppeteer", "playwright", "cypress", "electron"];

        for (var i = 0; i < bad_agents.length; i++) {
          if (request_user_agent.indexOf(bad_agents[i]) !== -1) {
            message = '🔴 Invalid User-Agent header value. Request from bot';
            status_code = 403;
            claim_request({ event_name: event_name }, status_code, message);
            return;
          }
        }
      }

      // Check Streaming Protocol requests API key
      if (event_origin === 'Streaming Protocol') {
        if (!data.add_api_key) {
          message = '🔴 Add API key for Streaming Protocol is not enabled.';
          status_code = 403;

          claim_request({ event_name: event_name }, status_code, message);
          return;
        }

        if (event_api_key !== api_key) {
          message = '🔴 Invalid API key';
          status_code = 401;

          claim_request({ event_name: event_name }, status_code, message);
          return;
        }
      }

      // Check if page_view is from Streaming Protocol
      if (event_name === 'page_view' && event_origin === 'Streaming Protocol') {
        message = '🔴 Invalid event_name. Can\'t send page_view from Streaming Protocol';
        status_code = 400;

        claim_request({ event_name: event_name }, status_code, message);
        return;
      }

      // Check if user cookie is missing
      if (event_origin === 'Website' && event_data.event_name !== 'page_view' && event_data.event_name !== 'get_user_data' && user_cookie_value === undefined) {
        message = '🔴 Orphan event: missing user cookie. Trigger a page_view event first to create a new user and a new session';
        status_code = 400;

        claim_request({ event_name: event_name }, status_code, message);
        return;
      }

      // Check if session cookie is missing
      if (event_origin === 'Website' && event_data.event_name !== 'page_view' && event_data.event_name !== 'get_user_data' && session_cookie_value === undefined) {
        message = '🔴 Orphan event: missing session cookie. Trigger a page_view event first to create a new session';
        status_code = 400;

        claim_request({ event_name: event_name }, status_code, message);
        return;
      }

      // Check if cookie format is valid
      if (!validate_user_cookie(user_cookie_value) || !validate_session_cookie(session_cookie_value)) {
        message = '🔴 Invalid cookie format';
        status_code = 400;

        claim_request({ event_name: event_name }, status_code, message);
        return;
      }

      // CLAIM REQUESTS 
      // Claim get user data requests
      if (event_name === 'get_user_data') {
        if (data.enable_logs) { log('🟢 Request correct, user and session cookies found. Cross-domain URL decoration will be applied'); }

        message = '🟢 Request claimed successfully';
        status_code = 200;

        claim_request(set_ids_get_user_data(), status_code, message);
        return;
      } else {
        // Claim standard requests
        if (data.enable_logs) { log('🟢 Request correct'); }

        const processed_event_data = build_payload(set_ids(event_data));
        const reserved_parameter_errors = validate_reserved_parameters(processed_event_data);

        if (reserved_parameter_errors.length > 0) {
          message = '🔴 Invalid payload schema: ' + reserved_parameter_errors.join('; ');
          status_code = 400;

          claim_request({ event_name: processed_event_data.event_name }, status_code, message);
          return;
        }

        claim_request(processed_event_data, null, '');
        return;
      }

    } else {
      return_method_not_allowed_response();
      return;
    }
  } else {
    if (data.enable_logs) { log('CHECKING REQUEST'); }

    // RETURN RESPONSE ERRORS
    message = '🔴 Request IP not authorized';
    status_code = 403;

    claim_request({ event_name: event_name }, status_code, message);
    return;
  }
} else {
  if (data.enable_logs) { log('CHECKING REQUEST'); }

  // RETURN RESPONSE ERRORS
  message = '🔴 Request origin not authorized';
  status_code = 403;

  claim_request({ event_name: event_name }, status_code, message);
  return;
}


// Log the active client tag configuration
// Printed in full before any validation runs, so the block is complete
// even when the request is refused by the first check.
function log_client_tag_configuration() {
  if (!data.enable_logs) { return; }

  var authorized_domains = '';
  if (data.add_authorized_domains) {
    const authorized_domains_list = data.authorized_domains_list;
    for (var i = 0; i < authorized_domains_list.length; i++) {
      authorized_domains = authorized_domains.concat(', ', computeEffectiveTldPlusOne(authorized_domains_list[i].authorized_domain));
    }
  }

  var banned_ips = '';
  if (data.add_banned_ips) {
    const banned_ip_list = data.banned_ips_list;
    for (var j = 0; j < banned_ip_list.length; j++) {
      banned_ips = banned_ips.concat(', ', banned_ip_list[j].banned_ip);
    }
  }

  log('👉 Endpoint:', endpoint);
  log('👉 Authorized origins:', (data.add_authorized_domains) ? authorized_domains.slice(2) : ' All');
  if (data.enable_bot_protection) { log('👉 Bot detection enabled'); }
  log('👉 Unauthorized IPs:', (data.add_banned_ips) ? banned_ips.slice(2) : 'None');
}


// Check request origin
function check_origin() {
  const authorized_domains_list = (data.add_authorized_domains) ? data.authorized_domains_list : [{ authorized_domain: request_origin }];

  for (var i = 0; i < authorized_domains_list.length; i++) {
    if (computeEffectiveTldPlusOne(request_origin) === computeEffectiveTldPlusOne(authorized_domains_list[i].authorized_domain)) {
      return true;
    }
  }
}


// Check request ip
function check_ip() {
  const banned_ip_list = (data.add_banned_ips) ? data.banned_ips_list : [{ banned_ip: null }];

  for (var i = 0; i < banned_ip_list.length; i++) {
    if (request_ip === banned_ip_list[i].banned_ip) {
      return true;
    }
  }
}


// --------------------------------------------------------------------------------------------------------------
// HANDLE IDS
// --------------------------------------------------------------------------------------------------------------

// Handle ids for get_user_data requests (For cross-domain only)
function set_ids_get_user_data() {
  const client_id = user_cookie_value || 'undefined';
  const session_id = session_cookie_value || 'undefined';
  const page_id = (session_cookie_value) ? session_cookie_value.split('-')[1] : 'undefined';

  const event_data = {
    event_name: 'get_user_data',
    client_id: client_id,
    session_id: session_id.split('-')[0] || 'undefined',
    page_id: page_id
  };

  return event_data;
}


// Handle ids for standard requests
function set_ids(event_data) {
  const page_id = event_data.page_id;
  const event_id = event_data.event_id;
  const raw_cross_domain_id = event_data.event_data.cross_domain_id;

  // Accept the cross-domain ID only if it has a valid session_id format
  const cross_domain_id = validate_cross_domain_id(raw_cross_domain_id) ? raw_cross_domain_id : null;

  if (raw_cross_domain_id && !cross_domain_id) {
    if (data.enable_logs) { log('🟠 Invalid cross-domain ID format. Value ignored.'); }
    event_data.event_data.cross_domain_id = null;
  }

  // Cross-domain request
  if (event_origin === 'Website' && cross_domain_id) {
    const cross_domain_client_id = cross_domain_id.split('_')[0];
    const cross_domain_session_id = cross_domain_id;

    if (data.enable_logs) { log('👉 Cross-domain visit'); }

    // With an active session
    if (session_cookie_value) {
      // With different session id
      if (cross_domain_session_id !== session_cookie_value.split('-')[0]) {
        event_data.client_id = cross_domain_client_id;
        event_data.session_id = cross_domain_session_id;
        event_data.page_id = cross_domain_session_id + '-' + page_id;
        event_data.event_id = cross_domain_session_id + '-' + event_id;

        if (data.enable_logs) { log('👉 Create new client_id: ', cross_domain_client_id + ' and new session_id: ', cross_domain_session_id); }

        // With the same session id   
      } else {
        const old_client_id = user_cookie_value;
        const old_session_id = session_cookie_value.split('-')[0];

        event_data.client_id = old_client_id;
        event_data.session_id = old_session_id;
        event_data.page_id = old_session_id + '-' + page_id;
        event_data.event_id = old_session_id + '-' + event_id;

        if (data.enable_logs) { log('CHECKING USER AND SESSION COOKIES'); }
        if (data.enable_logs) { log('👉 Same client_id, same session_id'); }
        if (data.enable_logs) { log('👉 Extend cookies max-age'); }
      }

      // Without an active session         
    } else {
      event_data.client_id = cross_domain_client_id;
      event_data.session_id = cross_domain_session_id;
      event_data.page_id = cross_domain_session_id + '-' + page_id;
      event_data.event_id = cross_domain_session_id + '-' + event_id;

      if (data.enable_logs) { log('CHECKING USER AND SESSION COOKIES'); }
      if (data.enable_logs) { log('👉 Returning user, no active session'); }
      if (data.enable_logs) { log('👉 Same client_id: ', cross_domain_client_id + ', create new session_id: ', cross_domain_session_id); }
    }

    // No cross-domain request
  } else {
    // New user
    if (user_cookie_value === undefined) {
      const new_client_id = generate_alphanumeric();
      const new_session_id = new_client_id + '_' + generate_alphanumeric();

      event_data.client_id = new_client_id;
      event_data.session_id = new_session_id;
      event_data.page_id = new_session_id + '-' + page_id;
      event_data.event_id = new_session_id + '-' + event_id;

      if (data.enable_logs) { log('CHECKING USER AND SESSION COOKIES'); }
      if (data.enable_logs) { log('👉 New user, no active session'); }
      if (data.enable_logs) { log('👉 Create new client_id: ', new_client_id + ' and new session_id: ', new_session_id); }

      // Returning user
    } else if (user_cookie_value !== undefined) {
      // No session cookie
      if (session_cookie_value === undefined) {
        const old_client_id = user_cookie_value;
        const new_session_id = old_client_id + '_' + generate_alphanumeric();

        event_data.client_id = old_client_id;
        event_data.session_id = new_session_id;
        event_data.page_id = new_session_id + '-' + page_id;
        event_data.event_id = new_session_id + '-' + event_id;

        if (data.enable_logs) { log('CHECKING USER AND SESSION COOKIES'); }
        if (data.enable_logs) { log('👉 Returning user, no active session'); }
        if (data.enable_logs) { log('👉 Same client_id: ', old_client_id + ', create new session_id: ', new_session_id); }

        // Yes session cookie
      } else {
        const old_client_id = user_cookie_value;
        const old_session_id = session_cookie_value.split('-')[0];

        event_data.client_id = old_client_id;
        event_data.session_id = old_session_id;
        event_data.page_id = old_session_id + '-' + page_id;
        event_data.event_id = old_session_id + '-' + event_id;

        if (data.enable_logs) { log('CHECKING USER AND SESSION COOKIES'); }
        if (data.enable_logs) { log('👉 Same client_id, same session_id'); }
        if (data.enable_logs) { log('👉 Extend cookies max-age'); }
      }
    }
  }

  return event_data;
}


// Generate random alphanumeric ID 
function generate_alphanumeric() {
  var max_length = 15; // Change this to the desired length
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var alphanumeric_id = '';

  for (var i = 0; i < max_length; i++) {
    alphanumeric_id += chars.charAt(generateRandom(0, chars.length - 1));
  }

  return alphanumeric_id;
}


// --------------------------------------------------------------------------------------------------------------
// BUILD PAYLOAD
// --------------------------------------------------------------------------------------------------------------

// Build payload data for standard requests
function build_payload(event_data) {
  // Add additional info    

  // When hosting GTM Server-side on Cloud Run, follow this guide to correctly configure geolocation headers: https://www.simoahava.com/analytics/cloud-run-server-side-tagging-google-tag-manager/#add-geolocation-headers-to-the-traffic

  event_data.event_data.country = getRequestHeader('X-Appengine-Country') || getRequestHeader('X-Gclb-Country') || getRequestHeader('X-GEO-Country');
  event_data.event_data.city = getRequestHeader('X-Appengine-City') || getRequestHeader('X-Gclb-City') || getRequestHeader('X-GEO-City');

  event_data.gtm_data.ss_hostname = getRequestHeader('Host');
  event_data.gtm_data.ss_container_id = getContainerVersion().containerId;
  event_data.gtm_data.ss_tag_name = getClientName();
  event_data.gtm_data.ss_tag_id = null;
  event_data.gtm_data.processing_event_timestamp = getTimestampMillis();
  event_data.gtm_data.content_length = makeNumber(getRequestHeader('content-length'));

  // User data
  // Add or override user ID
  if (data.override_user_id) {
    event_data.session_data.user_id = (data.user_id === "null") ? null : data.user_id;
  }

  // Add user data from tag fields
  if (data.add_user_parameters) {
    const user_params = data.user_params_to_add;

    if (user_params !== undefined) {
      for (var i = 0; i < user_params.length; i++) {
        const param_name = user_params[i].param_name;
        const param_value = user_params[i].param_value;

        event_data.user_data[param_name] = param_value;
      }
    }
  }

  // Remove user data from tag fields
  if (data.remove_user_parameters) {
    const user_params = data.user_params_to_remove;

    if (user_params !== undefined) {
      for (var i = 0; i < user_params.length; i++) {
        const param_name = user_params[i].param_name;

        Object.delete(event_data.user_data, param_name);
      }
    }
  }


  // Session data
  // Add session data from tag fields
  if (data.add_session_parameters) {
    const session_params = data.session_params_to_add;

    if (session_params !== undefined) {
      for (var i = 0; i < session_params.length; i++) {
        const param_name = session_params[i].param_name;
        const param_value = session_params[i].param_value;

        event_data.session_data[param_name] = param_value;
      }
    }
  }

  // Remove session data from tag fields
  if (data.remove_session_parameters) {
    const session_params = data.session_params_to_remove;

    if (session_params !== undefined) {
      for (var i = 0; i < session_params.length; i++) {
        const param_name = session_params[i].param_name;

        Object.delete(event_data.session_data, param_name);
      }
    }
  }


  // Event data
  if (event_data.event_data.source) {
    event_data.event_data.tld_source = (computeEffectiveTldPlusOne(event_data.event_data.source) !== '') ? computeEffectiveTldPlusOne(event_data.event_data.source) : event_data.event_data.source;
  }

  // Add event data from tag fields
  if (data.add_event_parameters) {
    const event_params = data.event_params_to_add;

    if (event_params !== undefined) {
      for (var i = 0; i < event_params.length; i++) {
        const param_name = event_params[i].param_name;
        const param_value = event_params[i].param_value;

        event_data.event_data[param_name] = param_value;
      }
    }
  }

  // Remove event data from tag fields
  if (data.remove_event_parameters) {
    const event_params = data.event_params_to_remove;

    if (event_params !== undefined) {
      for (var i = 0; i < event_params.length; i++) {
        const param_name = event_params[i].param_name;

        Object.delete(event_data.event_data, param_name);
      }
    }
  }

  return event_data;
}


// --------------------------------------------------------------------------------------------------------------
// CHANNEL GROUPING
// --------------------------------------------------------------------------------------------------------------

// Source categories of the GA4 default channel group (support.google.com/analytics/answer/9756891), as Google lists them
const source_categories = {
  '360.cn': 'search',
  '43things': 'social',
  '43things.com': 'social',
  '51.com': 'social',
  '5ch.net': 'social',
  'aax-us-east.amazon-adsystem.com': 'shopping',
  'aax.amazon-adsystem.com': 'shopping',
  'academia.edu': 'social',
  'activerain': 'social',
  'activerain.com': 'social',
  'activeworlds': 'social',
  'activeworlds.com': 'social',
  'addthis': 'social',
  'addthis.com': 'social',
  'airg.ca': 'social',
  'alibaba': 'shopping',
  'alibaba.com': 'shopping',
  'alice': 'search',
  'allnurses.com': 'social',
  'allrecipes.com': 'social',
  'alumniclass': 'social',
  'alumniclass.com': 'social',
  'amazon': 'shopping',
  'amazon.co.uk': 'shopping',
  'amazon.com': 'shopping',
  'ameba.jp': 'social',
  'ameblo.jp': 'social',
  'americantowns': 'social',
  'americantowns.com': 'social',
  'amp.reddit.com': 'social',
  'ancestry.com': 'social',
  'anobii': 'social',
  'anobii.com': 'social',
  'answerbag': 'social',
  'answerbag.com': 'social',
  'answers.yahoo.com': 'social',
  'aol': 'search',
  'aolanswers': 'social',
  'aolanswers.com': 'social',
  'apps.facebook.com': 'social',
  'apps.shopify.com': 'shopping',
  'ar.pinterest.com': 'social',
  'ar.search.yahoo.com': 'search',
  'artstation.com': 'social',
  'ask': 'search',
  'askubuntu': 'social',
  'askubuntu.com': 'social',
  'asmallworld.com': 'social',
  'at.search.yahoo.com': 'search',
  'athlinks': 'social',
  'athlinks.com': 'social',
  'au.search.yahoo.com': 'search',
  'auone': 'search',
  'avg': 'search',
  'away.vk.com': 'social',
  'awe.sm': 'social',
  'b.hatena.ne.jp': 'social',
  'baby-gaga': 'social',
  'baby-gaga.com': 'social',
  'babyblog.ru': 'social',
  'babylon': 'search',
  'badoo': 'social',
  'badoo.com': 'social',
  'baidu': 'search',
  'bebo': 'social',
  'bebo.com': 'social',
  'beforeitsnews': 'social',
  'beforeitsnews.com': 'social',
  'bharatstudent': 'social',
  'bharatstudent.com': 'social',
  'biglobe': 'search',
  'biglobe.co.jp': 'search',
  'biglobe.ne.jp': 'search',
  'biip.no': 'social',
  'bing': 'search',
  'biswap.org': 'social',
  'bit.ly': 'social',
  'blackcareernetwork.com': 'social',
  'blackplanet': 'social',
  'blackplanet.com': 'social',
  'blip.fm': 'social',
  'blog.com': 'social',
  'blog.feedspot.com': 'social',
  'blog.goo.ne.jp': 'social',
  'blog.naver.com': 'social',
  'blog.twitch.tv': 'video',
  'blog.yahoo.co.jp': 'social',
  'blogg.no': 'social',
  'bloggang.com': 'social',
  'blogger': 'social',
  'blogger.com': 'social',
  'blogher': 'social',
  'blogher.com': 'social',
  'bloglines': 'social',
  'bloglines.com': 'social',
  'blogs.com': 'social',
  'blogsome': 'social',
  'blogsome.com': 'social',
  'blogspot': 'social',
  'blogspot.com': 'social',
  'blogster': 'social',
  'blogster.com': 'social',
  'blurtit': 'social',
  'blurtit.com': 'social',
  'bookmarks.yahoo.co.jp': 'social',
  'bookmarks.yahoo.com': 'social',
  'br.pinterest.com': 'social',
  'br.search.yahoo.com': 'search',
  'brightkite': 'social',
  'brightkite.com': 'social',
  'brizzly': 'social',
  'brizzly.com': 'social',
  'business.facebook.com': 'social',
  'buzzfeed': 'social',
  'buzzfeed.com': 'social',
  'buzznet': 'social',
  'buzznet.com': 'social',
  'ca.search.yahoo.com': 'search',
  'cafe.naver.com': 'social',
  'cafemom': 'social',
  'cafemom.com': 'social',
  'camospace': 'social',
  'camospace.com': 'social',
  'canalblog.com': 'social',
  'care.com': 'social',
  'care2': 'social',
  'care2.com': 'social',
  'caringbridge.org': 'social',
  'catster': 'social',
  'catster.com': 'social',
  'cbnt.io': 'social',
  'cellufun': 'social',
  'cellufun.com': 'social',
  'centerblog.net': 'social',
  'centrum.cz': 'search',
  'ch.search.yahoo.com': 'search',
  'chat.zalo.me': 'social',
  'checkout.shopify.com': 'shopping',
  'checkout.stripe.com': 'shopping',
  'chegg.com': 'social',
  'chicagonow': 'social',
  'chicagonow.com': 'social',
  'chiebukuro.yahoo.co.jp': 'social',
  'cl.search.yahoo.com': 'search',
  'classmates': 'social',
  'classmates.com': 'social',
  'classquest': 'social',
  'classquest.com': 'social',
  'cn.bing.com': 'search',
  'cnn': 'search',
  'co.pinterest.com': 'social',
  'co.search.yahoo.com': 'search',
  'cocolog-nifty': 'social',
  'cocolog-nifty.com': 'social',
  'comcast': 'search',
  'conduit': 'search',
  'copainsdavant.linternaute.com': 'social',
  'couchsurfing.org': 'social',
  'cozycot': 'social',
  'cozycot.com': 'social',
  'cr.shopping.naver.com': 'shopping',
  'cr2.shopping.naver.com': 'shopping',
  'crackle': 'video',
  'crackle.com': 'video',
  'cross.tv': 'social',
  'crunchyroll': 'social',
  'crunchyroll.com': 'social',
  'curiositystream': 'video',
  'curiositystream.com': 'video',
  'cyworld': 'social',
  'cyworld.com': 'social',
  'cz.pinterest.com': 'social',
  'd.hatena.ne.jp': 'social',
  'd.tube': 'video',
  'dailymotion': 'video',
  'dailymotion.com': 'video',
  'dailystrength.org': 'social',
  'dashboard.twitch.tv': 'video',
  'daum': 'search',
  'daum.net': 'search',
  'de.search.yahoo.com': 'search',
  'deluxe.com': 'social',
  'deviantart': 'social',
  'deviantart.com': 'social',
  'dianping': 'social',
  'dianping.com': 'social',
  'digg': 'social',
  'digg.com': 'social',
  'diigo': 'social',
  'diigo.com': 'social',
  'discover.hubpages.com': 'social',
  'disneyplus': 'video',
  'disneyplus.com': 'video',
  'disqus': 'social',
  'disqus.com': 'social',
  'dk.search.yahoo.com': 'search',
  'dogpile': 'search',
  'dogpile.com': 'search',
  'dogster': 'social',
  'dogster.com': 'social',
  'dol2day': 'social',
  'dol2day.com': 'social',
  'doostang': 'social',
  'doostang.com': 'social',
  'dopplr': 'social',
  'dopplr.com': 'social',
  'douban': 'social',
  'douban.com': 'social',
  'draft.blogger.com': 'social',
  'draugiem.lv': 'social',
  'drugs-forum': 'social',
  'drugs-forum.com': 'social',
  'duckduckgo': 'search',
  'dzone': 'social',
  'dzone.com': 'social',
  'ebay': 'shopping',
  'ebay.co.uk': 'shopping',
  'ebay.com': 'shopping',
  'ebay.com.au': 'shopping',
  'ebay.de': 'shopping',
  'ecosia.org': 'search',
  'edublogs.org': 'social',
  'elftown': 'social',
  'elftown.com': 'social',
  'email.seznam.cz': 'search',
  'eniro': 'search',
  'epicurious.com': 'social',
  'es.search.yahoo.com': 'search',
  'espanol.search.yahoo.com': 'search',
  'etsy': 'shopping',
  'etsy.com': 'shopping',
  'everforo.com': 'social',
  'exalead.com': 'search',
  'exblog.jp': 'social',
  'excite.com': 'search',
  'extole': 'social',
  'extole.com': 'social',
  'facebook': 'social',
  'facebook.com': 'social',
  'faceparty': 'social',
  'faceparty.com': 'social',
  'fandom.com': 'social',
  'fanpop': 'social',
  'fanpop.com': 'social',
  'fark': 'social',
  'fark.com': 'social',
  'fast.wistia.net': 'video',
  'fb': 'social',
  'fb.me': 'social',
  'fc2': 'social',
  'fc2.com': 'social',
  'feedspot': 'social',
  'feministing': 'social',
  'feministing.com': 'social',
  'fi.search.yahoo.com': 'search',
  'filmaffinity': 'social',
  'filmaffinity.com': 'social',
  'firmy.cz': 'search',
  'flickr': 'social',
  'flickr.com': 'social',
  'flipboard': 'social',
  'flipboard.com': 'social',
  'folkdirect': 'social',
  'folkdirect.com': 'social',
  'foodservice': 'social',
  'foodservice.com': 'social',
  'forums.androidcentral.com': 'social',
  'forums.crackberry.com': 'social',
  'forums.imore.com': 'social',
  'forums.nexopia.com': 'social',
  'forums.webosnation.com': 'social',
  'forums.wpcentral.com': 'social',
  'fotki': 'social',
  'fotki.com': 'social',
  'fotolog': 'social',
  'fotolog.com': 'social',
  'foursquare': 'social',
  'foursquare.com': 'social',
  'fr.search.yahoo.com': 'search',
  'free.facebook.com': 'social',
  'friendfeed': 'social',
  'friendfeed.com': 'social',
  'fruehstueckstreff.org': 'social',
  'fubar': 'social',
  'fubar.com': 'social',
  'gaiaonline': 'social',
  'gaiaonline.com': 'social',
  'gamerdna': 'social',
  'gamerdna.com': 'social',
  'gather.com': 'social',
  'geni.com': 'social',
  'getpocket.com': 'social',
  'glassboard': 'social',
  'glassboard.com': 'social',
  'glassdoor': 'social',
  'glassdoor.com': 'social',
  'globo': 'search',
  'go.mail.ru': 'search',
  'godtube': 'social',
  'godtube.com': 'social',
  'goldenline.pl': 'social',
  'goldstar': 'social',
  'goldstar.com': 'social',
  'goo.gl': 'social',
  'gooblog': 'social',
  'goodreads': 'social',
  'goodreads.com': 'social',
  'google': 'search',
  'google shopping': 'shopping',
  'google+': 'social',
  'google-play': 'search',
  'googlegroups.com': 'social',
  'googleplus': 'social',
  'govloop': 'social',
  'govloop.com': 'social',
  'gowalla': 'social',
  'gowalla.com': 'social',
  'gree.jp': 'social',
  'groups.google.com': 'social',
  'gulli.com': 'social',
  'gutefrage.net': 'social',
  'habbo': 'social',
  'habbo.com': 'social',
  'hatena': 'social',
  'help.hulu.com': 'video',
  'help.netflix.com': 'video',
  'hi5': 'social',
  'hi5.com': 'social',
  'hk.search.yahoo.com': 'search',
  'hootsuite': 'social',
  'hootsuite.com': 'social',
  'houzz': 'social',
  'houzz.com': 'social',
  'hoverspot': 'social',
  'hoverspot.com': 'social',
  'hr.com': 'social',
  'hu.pinterest.com': 'social',
  'hubculture': 'social',
  'hubculture.com': 'social',
  'hubpages.com': 'social',
  'hulu': 'video',
  'hulu.com': 'video',
  'hyves.net': 'social',
  'hyves.nl': 'social',
  'ibibo': 'social',
  'ibibo.com': 'social',
  'id.pinterest.com': 'social',
  'id.search.yahoo.com': 'search',
  'id.twitch.tv': 'video',
  'identi.ca': 'social',
  'ig': 'social',
  'igshopping': 'shopping',
  'imageshack': 'social',
  'imageshack.com': 'social',
  'imageshack.us': 'social',
  'imvu': 'social',
  'imvu.com': 'social',
  'in.pinterest.com': 'social',
  'in.search.yahoo.com': 'search',
  'incredimail': 'search',
  'insanejournal': 'social',
  'insanejournal.com': 'social',
  'instagram': 'social',
  'instagram.com': 'social',
  'instapaper': 'social',
  'instapaper.com': 'social',
  'internations.org': 'social',
  'interpals.net': 'social',
  'intherooms': 'social',
  'intherooms.com': 'social',
  'iq.com': 'video',
  'iqiyi': 'video',
  'iqiyi.com': 'video',
  'irc-galleria.net': 'social',
  'is.gd': 'social',
  'it.search.yahoo.com': 'search',
  'italki': 'social',
  'italki.com': 'social',
  'jammerdirect': 'social',
  'jammerdirect.com': 'social',
  'jappy.com': 'social',
  'jappy.de': 'social',
  'jobs.netflix.com': 'video',
  'justin.tv': 'video',
  'kaboodle.com': 'social',
  'kakao': 'social',
  'kakao.com': 'social',
  'kakaocorp.com': 'social',
  'kaneva': 'social',
  'kaneva.com': 'social',
  'kin.naver.com': 'social',
  'kvasir': 'search',
  'l.facebook.com': 'social',
  'l.instagram.com': 'social',
  'l.messenger.com': 'social',
  'last.fm': 'social',
  'lens.google.com': 'search',
  'librarything': 'social',
  'librarything.com': 'social',
  'lifestream.aol.com': 'social',
  'line': 'social',
  'line.me': 'social',
  'linkedin': 'social',
  'linkedin.com': 'social',
  'listal': 'social',
  'listal.com': 'social',
  'listography': 'social',
  'listography.com': 'social',
  'lite.qwant.com': 'search',
  'livedoor.com': 'social',
  'livedoorblog': 'social',
  'livejournal': 'social',
  'livejournal.com': 'social',
  'lm.facebook.com': 'social',
  'lnkd.in': 'social',
  'lycos': 'search',
  'm.alibaba.com': 'shopping',
  'm.baidu.com': 'search',
  'm.blog.naver.com': 'social',
  'm.cafe.naver.com': 'social',
  'm.facebook.com': 'social',
  'm.kin.naver.com': 'social',
  'm.naver.com': 'search',
  'm.search.naver.com': 'search',
  'm.shopping.naver.com': 'shopping',
  'm.sogou.com': 'search',
  'm.twitch.tv': 'video',
  'm.vk.com': 'social',
  'm.yelp.com': 'social',
  'm.youtube.com': 'video',
  'mail.rambler.ru': 'search',
  'mail.yandex.ru': 'search',
  'malaysia.search.yahoo.com': 'search',
  'mbga.jp': 'social',
  'medium.com': 'social',
  'meetin.org': 'social',
  'meetup': 'social',
  'meetup.com': 'social',
  'meinvz.net': 'social',
  'meneame.net': 'social',
  'menuism.com': 'social',
  'mercadolibre': 'shopping',
  'mercadolibre.com': 'shopping',
  'mercadolibre.com.ar': 'shopping',
  'mercadolibre.com.mx': 'shopping',
  'message.alibaba.com': 'shopping',
  'messages.google.com': 'social',
  'messages.yahoo.co.jp': 'social',
  'messenger': 'social',
  'messenger.com': 'social',
  'mix.com': 'social',
  'mixi.jp': 'social',
  'mobile.facebook.com': 'social',
  'mocospace': 'social',
  'mocospace.com': 'social',
  'mouthshut': 'social',
  'mouthshut.com': 'social',
  'movabletype': 'social',
  'movabletype.com': 'social',
  'msearch.shopping.naver.com': 'shopping',
  'msn': 'search',
  'msn.com': 'search',
  'mubi': 'social',
  'mubi.com': 'social',
  'music.youtube.com': 'video',
  'mx.search.yahoo.com': 'search',
  'my.opera.com': 'social',
  'myanimelist.net': 'social',
  'myheritage': 'social',
  'myheritage.com': 'social',
  'mylife': 'social',
  'mylife.com': 'social',
  'mymodernmet': 'social',
  'mymodernmet.com': 'social',
  'myspace': 'social',
  'myspace.com': 'social',
  'najdi': 'search',
  'naver': 'search',
  'naver.com': 'search',
  'netflix': 'video',
  'netflix.com': 'video',
  'netvibes': 'social',
  'netvibes.com': 'social',
  'news.google.com': 'search',
  'news.ycombinator.com': 'social',
  'newsshowcase': 'social',
  'nexopia': 'social',
  'ngopost.org': 'social',
  'niconico': 'social',
  'nicovideo.jp': 'social',
  'nightlifelink': 'social',
  'nightlifelink.com': 'social',
  'ning': 'social',
  'ning.com': 'social',
  'nl.pinterest.com': 'social',
  'nl.search.yahoo.com': 'search',
  'nl.shopping.net': 'shopping',
  'no.search.yahoo.com': 'search',
  'no.shopping.net': 'shopping',
  'ntp.msn.com': 'search',
  'nz.search.yahoo.com': 'search',
  'odnoklassniki.ru': 'social',
  'odnoklassniki.ua': 'social',
  'offer.alibaba.com': 'shopping',
  'okwave.jp': 'social',
  'old.reddit.com': 'social',
  'one.walmart.com': 'shopping',
  'onet': 'search',
  'onet.pl': 'search',
  'oneworldgroup.org': 'social',
  'onstartups': 'social',
  'onstartups.com': 'social',
  'opendiary': 'social',
  'opendiary.com': 'social',
  'order.shopping.yahoo.co.jp': 'shopping',
  'oshiete.goo.ne.jp': 'social',
  'out.reddit.com': 'social',
  'over-blog.com': 'social',
  'overblog.com': 'social',
  'paper.li': 'social',
  'partners.shopify.com': 'shopping',
  'partyflock.nl': 'social',
  'pe.search.yahoo.com': 'search',
  'ph.search.yahoo.com': 'search',
  'photobucket': 'social',
  'photobucket.com': 'social',
  'pinboard': 'social',
  'pinboard.in': 'social',
  'pingsta': 'social',
  'pingsta.com': 'social',
  'pinterest': 'social',
  'pinterest.at': 'social',
  'pinterest.ca': 'social',
  'pinterest.ch': 'social',
  'pinterest.cl': 'social',
  'pinterest.co.kr': 'social',
  'pinterest.co.uk': 'social',
  'pinterest.com': 'social',
  'pinterest.com.au': 'social',
  'pinterest.com.mx': 'social',
  'pinterest.de': 'social',
  'pinterest.es': 'social',
  'pinterest.fr': 'social',
  'pinterest.it': 'social',
  'pinterest.jp': 'social',
  'pinterest.nz': 'social',
  'pinterest.ph': 'social',
  'pinterest.pt': 'social',
  'pinterest.ru': 'social',
  'pinterest.se': 'social',
  'pixiv.net': 'social',
  'pl.pinterest.com': 'social',
  'pl.search.yahoo.com': 'search',
  'play.google.com': 'search',
  'playahead.se': 'social',
  'player.twitch.tv': 'video',
  'player.vimeo.com': 'video',
  'plurk': 'social',
  'plurk.com': 'social',
  'plus.google.com': 'social',
  'plus.url.google.com': 'social',
  'pocket.co': 'social',
  'posterous': 'social',
  'posterous.com': 'social',
  'pro.homeadvisor.com': 'social',
  'pulse.yahoo.com': 'social',
  'qapacity': 'social',
  'qapacity.com': 'social',
  'quechup': 'social',
  'quechup.com': 'social',
  'quora': 'social',
  'quora.com': 'social',
  'qwant': 'search',
  'qwant.com': 'search',
  'qzone.qq.com': 'social',
  'rakuten': 'search',
  'rakuten.co.jp': 'search',
  'rambler': 'search',
  'rambler.ru': 'search',
  'ravelry': 'social',
  'ravelry.com': 'social',
  'reddit': 'social',
  'reddit.com': 'social',
  'redux': 'social',
  'redux.com': 'social',
  'renren': 'social',
  'renren.com': 'social',
  'researchgate.net': 'social',
  'reunion': 'social',
  'reunion.com': 'social',
  'reverbnation': 'social',
  'reverbnation.com': 'social',
  'rtl.de': 'social',
  'ryze': 'social',
  'ryze.com': 'social',
  's3.amazonaws.com': 'shopping',
  'salespider': 'social',
  'salespider.com': 'social',
  'scoop.it': 'social',
  'screenrant': 'social',
  'screenrant.com': 'social',
  'scribd': 'social',
  'scribd.com': 'social',
  'scvngr': 'social',
  'scvngr.com': 'social',
  'se.search.yahoo.com': 'search',
  'se.shopping.net': 'shopping',
  'search-results': 'search',
  'search.aol.co.uk': 'search',
  'search.aol.com': 'search',
  'search.google.com': 'search',
  'search.smt.docomo.ne.jp': 'search',
  'search.ukr.net': 'search',
  'secondlife': 'social',
  'secondlife.com': 'social',
  'secureurl.ukr.net': 'search',
  'serverfault': 'social',
  'serverfault.com': 'social',
  'seznam': 'search',
  'seznam.cz': 'search',
  'sg.search.yahoo.com': 'search',
  'shareit': 'social',
  'sharethis': 'social',
  'sharethis.com': 'social',
  'shop.app': 'shopping',
  'shopify': 'shopping',
  'shopify.com': 'shopping',
  'shopping.naver.com': 'shopping',
  'shopping.yahoo.co.jp': 'shopping',
  'shopping.yahoo.com': 'shopping',
  'shopzilla': 'shopping',
  'shopzilla.com': 'shopping',
  'shvoong.com': 'social',
  'simplycodes.com': 'shopping',
  'sites.google.com': 'social',
  'skype': 'social',
  'skyrock': 'social',
  'skyrock.com': 'social',
  'slashdot.org': 'social',
  'slideshare.net': 'social',
  'smartnews.com': 'social',
  'snapchat': 'social',
  'snapchat.com': 'social',
  'so.com': 'search',
  'social': 'social',
  'sociallife.com.br': 'social',
  'socialvibe': 'social',
  'socialvibe.com': 'social',
  'sogou': 'search',
  'sogou.com': 'search',
  'sp-web.search.auone.jp': 'search',
  'spaces.live.com': 'social',
  'spoke': 'social',
  'spoke.com': 'social',
  'spruz': 'social',
  'spruz.com': 'social',
  'ssense.com': 'social',
  'stackapps': 'social',
  'stackapps.com': 'social',
  'stackexchange': 'social',
  'stackexchange.com': 'social',
  'stackoverflow': 'social',
  'stackoverflow.com': 'social',
  'stardoll.com': 'social',
  'startsiden': 'search',
  'startsiden.no': 'search',
  'stickam': 'social',
  'stickam.com': 'social',
  'store.shopping.yahoo.co.jp': 'shopping',
  'stripe': 'shopping',
  'stripe.com': 'shopping',
  'studivz.net': 'social',
  'suche.aol.de': 'search',
  'suomi24.fi': 'social',
  'superuser': 'social',
  'superuser.com': 'social',
  'sweeva': 'social',
  'sweeva.com': 'social',
  't.co': 'social',
  't.me': 'social',
  'tagged': 'social',
  'tagged.com': 'social',
  'taggedmail': 'social',
  'taggedmail.com': 'social',
  'talkbiznow': 'social',
  'talkbiznow.com': 'social',
  'taringa.net': 'social',
  'techmeme': 'social',
  'techmeme.com': 'social',
  'ted': 'video',
  'ted.com': 'video',
  'tencent': 'social',
  'tencent.com': 'social',
  'terra': 'search',
  'th.search.yahoo.com': 'search',
  'tiktok': 'social',
  'tiktok.com': 'social',
  'tinyurl': 'social',
  'tinyurl.com': 'social',
  'toolbox': 'social',
  'toolbox.com': 'social',
  'touch.facebook.com': 'social',
  'tr.pinterest.com': 'social',
  'tr.search.yahoo.com': 'search',
  'travellerspoint': 'social',
  'travellerspoint.com': 'social',
  'tripadvisor': 'social',
  'tripadvisor.com': 'social',
  'trombi': 'social',
  'trombi.com': 'social',
  'trustpilot': 'social',
  'tudou': 'social',
  'tudou.com': 'social',
  'tuenti': 'social',
  'tuenti.com': 'social',
  'tumblr': 'social',
  'tumblr.com': 'social',
  'tut.by': 'search',
  'tw.search.yahoo.com': 'search',
  'tweetdeck': 'social',
  'tweetdeck.com': 'social',
  'twitch': 'video',
  'twitch.tv': 'video',
  'twitter': 'social',
  'twitter.com': 'social',
  'twoo.com': 'social',
  'typepad': 'social',
  'typepad.com': 'social',
  'uk.search.yahoo.com': 'search',
  'uk.shopping.net': 'shopping',
  'ukr': 'search',
  'unblog.fr': 'social',
  'urbanspoon.com': 'social',
  'us.search.yahoo.com': 'search',
  'ushareit.com': 'social',
  'ushi.cn': 'social',
  'utreon': 'video',
  'utreon.com': 'video',
  'vampirefreaks': 'social',
  'vampirefreaks.com': 'social',
  'vampirerave': 'social',
  'vampirerave.com': 'social',
  'veoh': 'video',
  'veoh.com': 'video',
  'vg.no': 'social',
  'viadeo.journaldunet.com': 'video',
  'video.ibm.com': 'social',
  'vimeo': 'video',
  'vimeo.com': 'video',
  'virgilio': 'search',
  'vk.com': 'social',
  'vkontakte.ru': 'social',
  'vn.search.yahoo.com': 'search',
  'wakoopa': 'social',
  'wakoopa.com': 'social',
  'walmart': 'shopping',
  'walmart.com': 'shopping',
  'wap.sogou.com': 'search',
  'wattpad': 'social',
  'wattpad.com': 'social',
  'web.facebook.com': 'social',
  'web.skype.com': 'social',
  'webmaster.yandex.ru': 'search',
  'websearch.rakuten.co.jp': 'search',
  'webshots': 'social',
  'webshots.com': 'social',
  'wechat': 'social',
  'wechat.com': 'social',
  'weebly': 'social',
  'weebly.com': 'social',
  'weibo': 'social',
  'weibo.com': 'social',
  'wer-weiss-was.de': 'social',
  'weread': 'social',
  'weread.com': 'social',
  'whatsapp': 'social',
  'whatsapp.com': 'social',
  'wiki.answers.com': 'social',
  'wikihow.com': 'social',
  'wikitravel.org': 'social',
  'wistia': 'video',
  'wistia.com': 'video',
  'woot.com': 'social',
  'wordpress': 'social',
  'wordpress.com': 'social',
  'wordpress.org': 'social',
  'xanga': 'social',
  'xanga.com': 'social',
  'xing': 'social',
  'xing.com': 'social',
  'yahoo': 'search',
  'yahoo-mbga.jp': 'social',
  'yahoo.co.jp': 'search',
  'yahoo.com': 'search',
  'yammer': 'social',
  'yammer.com': 'social',
  'yandex': 'search',
  'yandex.by': 'search',
  'yandex.com': 'search',
  'yandex.com.tr': 'search',
  'yandex.fr': 'search',
  'yandex.kz': 'search',
  'yandex.ru': 'search',
  'yandex.ua': 'search',
  'yandex.uz': 'search',
  'yelp': 'social',
  'yelp.co.uk': 'social',
  'yelp.com': 'social',
  'youku': 'video',
  'youku.com': 'video',
  'youroom.in': 'social',
  'youtube': 'video',
  'youtube.com': 'video',
  'za.pinterest.com': 'social',
  'zalo': 'social',
  'zen.yandex.ru': 'search',
  'zoo.gr': 'social',
  'zooppa': 'social',
  'zooppa.com': 'social'
};

const channel_patterns = {
  cross_network: createRegex('cross-network', 'i'),
  ai: createRegex('(^|[^a-z0-9])(chatgpt|openai|gemini|bard|claude|copilot|perplexity|deepseek|grok)|\\.ai$', 'i'),
  webmail: createRegex('^(mail|webmail)\\.', 'i'),
  google_non_search: createRegex('^(mail|docs|drive|sites|calendar|meet|classroom|groups|accounts|play)\\.google\\.', 'i'),
  search: createRegex('(^|[^a-z0-9])(360\\.cn|baidu|duckduckgo|ecosia|google|naver|qwant|seznam|sogou|startpage|yahoo|yandex)|(^|[^a-z0-9])(alice|aol|ask|bing|brave)([^a-z0-9]|$)', 'i'),
  social: createRegex('(^|[^a-z0-9])(fb|ig)([^a-z0-9]|$)|(^|[^a-z0-9])(facebook|instagram|threads\\.(net|com)|twitter|bsky|linkedin|lnkd\\.in|pinterest|reddit|vk\\.com|tiktok|snapchat|tumblr|wechat|whatsapp|telegram|discord|mastodon|quora)|(^|\\.)(t\\.co|x\\.com)$', 'i'),
  shopping: createRegex('(^|[^a-z0-9])(amazon|ebay|etsy|shopify|walmart|mercadolibre|alibaba|aliexpress|zalando)', 'i'),
  shopping_campaign: createRegex('(^|[^a-df-z])shop|shopping', 'i'),
  video: createRegex('(^|[^a-z0-9])(youtube|vimeo|netflix|twitch|dailymotion|hulu|disneyplus|wistia|youku)', 'i'),
  email_source: createRegex('(^|[^a-z0-9])(email|e-mail|e_mail|e mail|newsletter|mailchimp|sendgrid|sparkpost|klaviyo|brevo|hubspot)', 'i'),
  medium_ai: createRegex('^ai-assistant$', 'i'),
  medium_paid: createRegex('^(.*cp.*|ppc|retargeting|paid.*)$', 'i'),
  medium_display: createRegex('^(display|banner|expandable|interstitial|cpm)$', 'i'),
  medium_email: createRegex('^(email|e-mail|e_mail|e mail|newsletter)$', 'i'),
  medium_affiliate: createRegex('^affiliate$', 'i'),
  medium_sms: createRegex('^sms$', 'i'),
  medium_audio: createRegex('^audio$', 'i'),
  medium_push: createRegex('push$|mobile|notification', 'i'),
  medium_organic: createRegex('^organic$', 'i'),
  medium_social: createRegex('^(social|social-network|social-media|sm|social network|social media)$', 'i'),
  medium_video: createRegex('video', 'i'),
  medium_referral: createRegex('^(referral|app|link)$', 'i')
};


// The source's GA4 category: the source itself without www., else its registrable domain
function get_source_category(source) {
  var host = source.toLowerCase();
  if (host.indexOf('www.') === 0) { host = host.substring(4); }
  if (source_categories.hasOwnProperty(host)) { return source_categories[host]; }

  const domain = computeEffectiveTldPlusOne(host);
  if (domain && domain !== host && source_categories.hasOwnProperty(domain)) { return source_categories[domain]; }

  return null;
}


// GA4 default channel group rules on source, medium and campaign, with three differences: an explicit medium wins
// over the source category, a click ID on a search engine source is paid search (Google Ads and Microsoft Ads
// auto-tagging), and source names are also matched at the start of the source or of one of its parts
// (google.it, googleads), for sources the GA4 list does not have.
function get_channel_grouping(source, medium, campaign, campaign_click_id) {
  const s = source || '';
  const m = medium || '';
  const c = campaign || '';

  if ((s === '' || s === 'direct') && m === '') return 'direct';
  if (s === 'tagassistant.google.com') return 'gtm_debugger';
  if (testRegex(channel_patterns.cross_network, c)) return 'cross_network';

  const category = get_source_category(s);
  const is_shopping = category === 'shopping' || (!category && testRegex(channel_patterns.shopping, s));
  const is_search = category === 'search' || (!category && testRegex(channel_patterns.search, s) && !testRegex(channel_patterns.google_non_search, s));
  const is_social = category === 'social' || (!category && testRegex(channel_patterns.social, s));
  const is_video = category === 'video' || (!category && testRegex(channel_patterns.video, s));

  if (m !== '') {
    if (testRegex(channel_patterns.medium_ai, m)) return 'ai';
    if (testRegex(channel_patterns.medium_paid, m)) {
      if (is_shopping || testRegex(channel_patterns.shopping_campaign, c)) return 'paid_shopping';
      if (is_search) return 'paid_search_engine';
      if (is_social) return 'paid_social';
      if (is_video) return 'paid_video';
    }
    if (testRegex(channel_patterns.medium_display, m)) return 'display';
    if (testRegex(channel_patterns.medium_paid, m)) return 'paid_other';
    if (testRegex(channel_patterns.medium_email, m)) return 'email';
    if (testRegex(channel_patterns.medium_affiliate, m)) return 'affiliate';
    if (testRegex(channel_patterns.medium_sms, m)) return 'sms';
    if (testRegex(channel_patterns.medium_audio, m)) return 'audio';
    if (testRegex(channel_patterns.medium_push, m)) return 'mobile_push';
    if (testRegex(channel_patterns.medium_organic, m)) return 'organic_search_engine';
    if (testRegex(channel_patterns.medium_social, m)) return 'organic_social';
    if (testRegex(channel_patterns.medium_video, m)) return 'organic_video';
    if (testRegex(channel_patterns.medium_referral, m)) return 'referral';
  }

  if (testRegex(channel_patterns.ai, s)) return 'ai';
  if (testRegex(channel_patterns.webmail, s)) return 'email';
  if (!category && testRegex(channel_patterns.google_non_search, s)) return 'referral';
  if (is_search) return campaign_click_id ? 'paid_search_engine' : 'organic_search_engine';
  if (is_social) return 'organic_social';
  if (is_shopping || testRegex(channel_patterns.shopping_campaign, c)) return 'organic_shopping';
  if (is_video) return 'organic_video';
  if (testRegex(channel_patterns.email_source, s)) return 'email';
  if (s.toLowerCase() === 'sms') return 'sms';
  if (s.toLowerCase() === 'firebase') return 'mobile_push';

  return (m !== '' || c !== '') ? 'unassigned' : 'referral';
}


// --------------------------------------------------------------------------------------------------------------
// CLAIM REQUESTS
// --------------------------------------------------------------------------------------------------------------

// Claim requests
function claim_request(event_data, status_code, message) {
  claimRequest();

  const processing_status = {
    claim_request: 'pending',
    firestore: 'pending',
    bigquery: 'pending',
    custom_endpoint: (data.send_data_to_custom_endpoint) ? 'pending' : 'skipped'
  };


  // ERROR RESPONSE
  if (status_code >= 400) {
    processing_status.claim_request = 'failed';
    processing_status.firestore = 'skipped';
    processing_status.bigquery = 'skipped';
    processing_status.custom_endpoint = 'skipped';

    if (data.enable_logs) { log('REQUEST STATUS'); }
    if (data.enable_logs) { log(message); }

    return_response(
      event_data,
      status_code,
      message,
      processing_status
    );

    return;
  }


  // GET USER DATA REQUESTS
  if (event_data.event_name === 'get_user_data') {
    processing_status.claim_request = 'success';
    processing_status.firestore = 'skipped';
    processing_status.bigquery = 'skipped';
    processing_status.custom_endpoint = 'skipped';

    if (data.enable_logs) { log('REQUEST STATUS'); }
    if (data.enable_logs) { log(message); }

    return_response(
      event_data,
      status_code,
      message,
      processing_status
    );

    return;
  }


  // STANDARD REQUESTS
  processing_status.claim_request = 'success';

  // SEND DATA TO FIRESTORE
  if (data.enable_logs) {log('SENDING EVENT DATA TO GOOGLE FIRESTORE');}

  send_to_firestore(event_data)
    .then((firestore_res) => {

      // Firestore failed
      if (firestore_res.status !== true) {
        processing_status.firestore = 'failed';
        processing_status.bigquery = 'skipped';
        processing_status.custom_endpoint = 'skipped';

        if (data.enable_logs) { log('REQUEST STATUS'); }
        if (data.enable_logs) { log(firestore_res.message); }

        return_response(
          event_data,
          firestore_res.status_code,
          firestore_res.message,
          processing_status
        );

        return null;
      }

      // Firestore success
      processing_status.firestore = 'success';
      if (data.enable_logs) {log('SENDING EVENT DATA TO GOOGLE BIGQUERY');}

      return send_to_bq(event_data);
    })


    // BIGQUERY RESPONSE
    .then((bq_res) => {
      // Processing already stopped
      if (bq_res === null || bq_res === undefined) {return null;}

      // BigQuery failed
      if (bq_res.status !== true) {
        processing_status.bigquery = 'failed';
        processing_status.custom_endpoint = 'skipped';

        if (data.enable_logs) { log('REQUEST STATUS'); }
        if (data.enable_logs) { log(bq_res.message); }

        return_response(
          event_data,
          bq_res.status_code,
          bq_res.message,
          processing_status
        );

        return null;
      }


      // BigQuery success
      processing_status.bigquery = 'success';

      // Send data to custom endpoint enable
      if (!data.send_data_to_custom_endpoint) {
        return {
          status: true,
          custom_endpoint_skipped: true
        };
      }


      // Send data to custom endpoint enable
      if (data.enable_logs) {log('SENDING EVENT DATA TO CUSTOM ENDPOINT');}

      return send_to_custom_endpoint(
        data.custom_request_endpoint_path,
        event_data
      );
    })


    // CUSTOM ENDPOINT RESPONSE
    .then((endpoint_res) => {

      // Processing already stopped
      if (endpoint_res === null || endpoint_res === undefined) {
        return;
      }

      if (endpoint_res.custom_endpoint_skipped === true) {
        processing_status.custom_endpoint = 'skipped';
      } else if (endpoint_res.status === true) {
        processing_status.custom_endpoint = 'success';
      } else {
        processing_status.custom_endpoint = 'failed';
      }


      // SUCCESS RESPONSE
      message = '🟢 Request processed successfully';
      status_code = 200;

      if (data.enable_logs) { log('REQUEST STATUS'); }
      if (data.enable_logs) { log(message); }

      return_response(
        event_data,
        status_code,
        message,
        processing_status
      );
    })

    // OTHER ERRORS
    .catch((error) => {

      if (processing_status.firestore === 'pending') {
        processing_status.firestore = 'failed';
        processing_status.bigquery = 'skipped';
        processing_status.custom_endpoint = 'skipped';

        message = '🔴 Firestore request failed';

      } else if (processing_status.bigquery === 'pending') {
        processing_status.bigquery = 'failed';
        processing_status.custom_endpoint = 'skipped';

        message = '🔴 BigQuery request failed';

      } else if (processing_status.custom_endpoint === 'pending') {
        processing_status.custom_endpoint = 'failed';

        message = '🔴 Custom endpoint request failed';

      } else {
        message = '🔴 Request processing failed';
      }

      status_code = 500;

      if (data.enable_logs) {log('REQUEST STATUS');}
      if (data.enable_logs) {log(message);}
      if (data.enable_logs) {log(error);}

      return_response(
        event_data,
        status_code,
        message,
        processing_status
      );
    });
}


// Return response
function return_invalid_json_response() {
  return_request_error_response(400, '🔴 Invalid JSON request body');
}


function return_invalid_payload_schema_response(errors) {
  return_request_error_response(400, '🔴 Invalid payload schema: ' + errors.join('; '));
}


function return_method_not_allowed_response() {
  return_request_error_response(405, '🔴 Request method not correct');
}


function return_request_error_response(status_code, message) {
  const processing_status = {
    claim_request: 'failed',
    firestore: 'skipped',
    bigquery: 'skipped',
    custom_endpoint: 'skipped'
  };

  if (data.enable_logs) {
    log('NAMELESS ANALYTICS');
    log('CLIENT TAG CONFIGURATION');
    log('CHECKING REQUEST');
    log(message);
    log('REQUEST STATUS');
    log('🔴 Request refused');
  }

  claimRequest();
  setResponseStatus(status_code);

  if (request_origin) {
    setResponseHeader('Access-Control-Allow-Credentials', 'true');
    setResponseHeader('Access-Control-Allow-Origin', request_origin);
  }

  setResponseHeader('Access-Control-Allow-Methods', 'POST');
  if (status_code === 405) {
    setResponseHeader('Allow', 'POST');
  }
  setResponseHeader('cache-control', 'no-store');
  setResponseHeader('content-type', 'application/json');

  setResponseBody(JSON.stringify({
    status_code: status_code,
    response: message,
    processing: processing_status,
    data: null
  }));

  returnResponse();
}


function return_response(event_data, status_code, message, processing_status) {
  runContainer(event_data, () => {
    setResponseStatus(status_code);

    if (request_origin) {
      setResponseHeader('Access-Control-Allow-Credentials', 'true');
      setResponseHeader('Access-Control-Allow-Origin', request_origin);
    }

    setResponseHeader('Access-Control-Allow-Methods', 'POST');
    if (status_code === 401) {
      setResponseHeader('WWW-Authenticate', 'ApiKey realm="Nameless Analytics"');
    }
    setResponseHeader('cache-control', 'no-store');
    setResponseHeader('content-type', 'application/json');

    setResponseBody(JSON.stringify({
      status_code: status_code,
      response: message,
      processing: processing_status,
      data: event_data
    }));

    returnResponse();

    if (status_code >= 400) {
      if (data.enable_logs) {log('🔴 Request refused');}
    }
  });
}


// --------------------------------------------------------------------------------------------------------------
// SEND DATA TO GOOGLE FIRESTORE
// --------------------------------------------------------------------------------------------------------------

function send_to_firestore(event_data) {
  const project_id = data.bq_project_id;
  const queries = [['client_id', '==', event_data.client_id]];
  const collection_path = 'users';
  const document_path = collection_path + '/' + event_data.client_id;
  var transaction_result;
  var request_validated = false;

  return Firestore.runTransaction((transaction) => {
    transaction_result = null;
    request_validated = false;

    const query_options = {
      projectId: project_id,
      limit: 1,
      transaction: transaction
    };
    const write_options = {
      projectId: project_id,
      merge: true,
      transaction: transaction
    };

    return Firestore.query(collection_path, queries, query_options)
      .then((documents) => {

        // REJECT REQUESTS (orphan events)
        if (event_data.event_name !== 'page_view' && documents.length === 0) {
          transaction_result = {
            status: false,
            status_code: 400,
            message: "🔴 Orphan event: user doesn't exist in Firestore. Trigger a page_view event first to create a new user and a new session"
          };
          return transaction_result;
        } else if (event_data.event_name !== 'page_view' && !documents[0].data.sessions.some(s => s.session_id === event_data.session_id)) {
          transaction_result = {
            status: false,
            status_code: 400,
            message: "🔴 Orphan event: session doesn't exist in Firestore. Trigger a page_view event first to create a new session"
          };
          return transaction_result;
        }

        request_validated = true;

        // If user does not exist in Firestore
        if (documents.length === 0) {
          const firestore_data = {
            user_date: event_data.event_date,
            client_id: event_data.client_id,
            user_channel_grouping: event_data.event_data.channel_grouping,
            user_source: event_data.event_data.source,
            user_tld_source: event_data.event_data.tld_source,
            user_campaign: event_data.event_data.campaign,
            user_campaign_id: event_data.event_data.campaign_id,
            user_campaign_click_id: event_data.event_data.campaign_click_id,
            user_campaign_term: event_data.event_data.campaign_term,
            user_campaign_content: event_data.event_data.campaign_content,
            user_medium: event_data.event_data.medium,
            user_device_type: event_data.event_data.device_type,
            user_country: event_data.event_data.country,
            user_city: event_data.event_data.city,
            user_language: event_data.event_data.browser_language,
            user_first_session_timestamp: (event_data.event_name === 'page_view') ? event_data.event_timestamp : null,
            user_last_session_timestamp: (event_data.event_name === 'page_view') ? event_data.event_timestamp : null,
            sessions: [{
              session_date: event_data.event_date,
              session_id: event_data.session_id,
              session_number: 1,
              cross_domain_session: (event_data.event_data.cross_domain_id) ? 'Yes' : 'No',
              session_channel_grouping: event_data.event_data.channel_grouping,
              session_source: event_data.event_data.source,
              session_tld_source: event_data.event_data.tld_source,
              session_campaign: event_data.event_data.campaign,
              session_campaign_id: event_data.event_data.campaign_id,
              session_campaign_click_id: event_data.event_data.campaign_click_id,
              session_campaign_term: event_data.event_data.campaign_term,
              session_campaign_content: event_data.event_data.campaign_content,
              session_medium: event_data.event_data.medium,
              session_device_type: event_data.event_data.device_type,
              session_country: event_data.event_data.country,
              session_city: event_data.event_data.city,
              session_language: event_data.event_data.browser_language,
              session_hostname: event_data.page_data.page_hostname,
              session_browser_name: event_data.event_data.browser_name,
              session_landing_page_category: event_data.page_data.page_category,
              session_landing_page_url: event_data.page_data.page_url,
              session_landing_page_path: event_data.page_data.page_path,
              session_landing_page_title: event_data.page_data.page_title,
              session_exit_page_category: event_data.page_data.page_category,
              session_exit_page_url: event_data.page_data.page_url,
              session_exit_page_path: event_data.page_data.page_path,
              session_exit_page_title: event_data.page_data.page_title,
              session_start_timestamp: (event_data.event_name === 'page_view') ? event_data.event_timestamp : null,
              session_end_timestamp: event_data.event_timestamp,
              user_id: event_data.session_data.user_id || null
            }]
          };

          // Add user parameters to Firestore
          for (var key in event_data.user_data) {
            if (event_data.user_data.hasOwnProperty(key)) {
              firestore_data[key] = event_data.user_data[key];
            }
          }

          // Add session parameters to Firestore
          for (var key in event_data.session_data) {
            if (event_data.session_data.hasOwnProperty(key)) {
              firestore_data.sessions[0][key] = event_data.session_data[key];
            }
          }

          transaction_result = {
            status: true,
            action: 'create_user',
            firestore_data: firestore_data
          };

          return Firestore.write(document_path, firestore_data, write_options);
        }

        // If user exists in Firestore
        const firestore_data = documents[0].data;
        const sessions_data = firestore_data.sessions;
        const last_session = sessions_data.filter(s => s.session_id === event_data.session_id)[0];
        const actual_last_session = sessions_data.length > 0 ? sessions_data[sessions_data.length - 1] : null;

        // Update user values in Firestore from current user data if not already exists or has a not null value
        const protected_user_keys = [
          "user_date",
          "user_channel_grouping",
          "user_source",
          "user_tld_source",
          "user_campaign",
          "user_campaign_id",
          "user_campaign_click_id",
          "user_campaign_term",
          "user_campaign_content",
          "user_medium",
          "user_device_type",
          "user_country",
          "user_city",
          "user_language",
          "user_first_session_timestamp",
          "user_last_session_timestamp"
        ];

        Object.keys(event_data.user_data).forEach(function (key) {
          const value = event_data.user_data[key];

          if (value == null) { return; }
          if (protected_user_keys.indexOf(key) !== -1 && firestore_data[key] != null) { return; }

          if (firestore_data[key] !== value) {
            firestore_data[key] = value;
          }
        });

        // If session doesn't exist in Firestore
        if (!last_session) {
          firestore_data.user_last_session_timestamp = event_data.event_timestamp;

          const new_session = {
            session_date: event_data.event_date,
            session_id: event_data.session_id,
            session_number: actual_last_session ? actual_last_session.session_number + 1 : 1,
            cross_domain_session: (event_data.event_data.cross_domain_id) ? 'Yes' : 'No',
            session_channel_grouping: event_data.event_data.channel_grouping,
            session_source: event_data.event_data.source,
            session_tld_source: event_data.event_data.tld_source,
            session_campaign: event_data.event_data.campaign,
            session_campaign_id: event_data.event_data.campaign_id,
            session_campaign_click_id: event_data.event_data.campaign_click_id,
            session_campaign_term: event_data.event_data.campaign_term,
            session_campaign_content: event_data.event_data.campaign_content,
            session_medium: event_data.event_data.medium,
            session_device_type: event_data.event_data.device_type,
            session_country: event_data.event_data.country,
            session_city: event_data.event_data.city,
            session_language: event_data.event_data.browser_language,
            session_hostname: event_data.page_data.page_hostname,
            session_browser_name: event_data.event_data.browser_name,
            session_landing_page_category: (event_data.page_data.page_category) ? event_data.page_data.page_category : null,
            session_landing_page_url: event_data.page_data.page_url,
            session_landing_page_path: event_data.page_data.page_path,
            session_landing_page_title: event_data.page_data.page_title,
            session_exit_page_category: (event_data.page_data.page_category) ? event_data.page_data.page_category : null,
            session_exit_page_url: event_data.page_data.page_url,
            session_exit_page_path: event_data.page_data.page_path,
            session_exit_page_title: event_data.page_data.page_title,
            session_start_timestamp: (event_data.event_name === 'page_view') ? event_data.event_timestamp : null,
            session_end_timestamp: event_data.event_timestamp,
            user_id: event_data.session_data.user_id || null
          };

          // Add session parameters for Firestore
          for (var key in event_data.session_data) {
            if (event_data.session_data.hasOwnProperty(key)) {
              new_session[key] = event_data.session_data[key];
            }
          }

          firestore_data.sessions.push(new_session);
          transaction_result = {
            status: true,
            action: 'add_session',
            firestore_data: firestore_data
          };

          return Firestore.write(document_path, firestore_data, write_options);
        }

        // If session exists in Firestore
        // Update session values in Firestore from current session data if not already exists or has a not null value
        const protected_session_keys = [
          "session_date",
          "session_id",
          "session_number",
          "cross_domain_session",
          "session_channel_grouping",
          "session_source",
          "session_tld_source",
          "session_campaign",
          "session_campaign_id",
          "session_campaign_click_id",
          "session_campaign_term",
          "session_campaign_content",
          "session_medium",
          "session_device_type",
          "session_country",
          "session_city",
          "session_language",
          "session_hostname",
          "session_browser_name",
          "session_landing_page_category",
          "session_landing_page_url",
          "session_landing_page_path",
          "session_landing_page_title",
          "session_exit_page_category",
          "session_exit_page_url",
          "session_exit_page_path",
          "session_exit_page_title",
          "session_start_timestamp",
          "session_end_timestamp",
          "user_id"
        ];

        Object.keys(event_data.session_data).forEach(function (key) {
          const value = event_data.session_data[key];

          if (value == null) { return; }
          if (protected_session_keys.indexOf(key) !== -1 && last_session[key] != null) { return; }

          if (last_session[key] !== value) {
            last_session[key] = value;
          }
        });

        // Set exit page data
        if (event_origin === 'Website' && event_data.event_timestamp >= last_session.session_end_timestamp) {
          last_session.session_exit_page_category = (event_data.page_data.page_category) ? event_data.page_data.page_category : null;
          last_session.session_exit_page_url = event_data.page_data.page_url;
          last_session.session_exit_page_path = event_data.page_data.page_path;
          last_session.session_exit_page_title = event_data.page_data.page_title;
          last_session.session_end_timestamp = event_data.event_timestamp;
        }

        // Set cross-domain session flag
        if (last_session.cross_domain_session === 'No') {
          last_session.cross_domain_session = (event_data.event_data.cross_domain_id) ? 'Yes' : 'No';
        }

        // Set user ID on login, clear it on logout
        if (event_data.event_name === 'login') { last_session.user_id = event_data.session_data.user_id || null; }
        if (event_data.event_name === 'logout') { last_session.user_id = null; }

        // Return result
        transaction_result = {
          status: true,
          action: 'update_session',
          firestore_data: firestore_data
        };

        return Firestore.write(document_path, firestore_data, write_options);
      });
  }, { projectId: project_id })
    .then(
      () => {
        if (!transaction_result) {
          return { status: false, status_code: 500, message: '🔴 Firestore request failed' };
        }

        if (transaction_result.status !== true) {
          return transaction_result;
        }

        set_request_cookies(event_data);
        log_firestore_transaction_result(transaction_result, true);

        if (!enrich_event_data_from_firestore(event_data, transaction_result.firestore_data)) {
          return { status: false, status_code: 500, message: '🔴 Firestore request failed' };
        }

        return { status: true, status_code: 200, message: '🟢 Request claimed successfully' };
      },
      (error) => {
        if (request_validated) {
          set_request_cookies(event_data);
        }

        log_firestore_transaction_result(transaction_result, false);
        if (data.enable_logs) { log(error); }

        return {
          status: false,
          status_code: 500,
          message: get_firestore_failure_message(transaction_result)
        };
      }
    );
}


// Set cookies
function set_request_cookies(event_data) {
  if (event_origin !== 'Website') { return; }

  const user_cookie_max_age = 400 * 24 * 60 * 60;
  const session_cookie_max_age = (makeNumber(data.session_max_age) || 30) * 60;

  set_cookie(user_cookie_name, event_data.client_id, user_cookie_max_age);
  set_cookie(session_cookie_name, event_data.page_id, session_cookie_max_age);
}


// Add user and session data to Google BigQuery
function enrich_event_data_from_firestore(event_data, firestore_data) {
  for (var key in firestore_data) {
    if (firestore_data.hasOwnProperty(key) && key !== 'sessions') {
      event_data.user_data[key] = firestore_data[key];
    }
  }

  event_data.user_date = event_data.user_data.user_date;
  Object.delete(event_data.user_data, 'user_date');
  Object.delete(event_data.user_data, 'client_id');

  const stored_session = firestore_data.sessions.filter(s => s.session_id === event_data.session_id)[0];
  if (!stored_session) { return false; }

  event_data.session_data = JSON.parse(JSON.stringify(stored_session));
  event_data.session_date = event_data.session_data.session_date;
  Object.delete(event_data.session_data, 'session_date');
  Object.delete(event_data.session_data, 'session_id');

  return true;
}


function log_firestore_transaction_result(transaction_result, success) {
  if (!data.enable_logs || !transaction_result || transaction_result.status !== true) { return; }

  if (transaction_result.action === 'create_user') {
    log('👉 User does not exist');
    log('👉 Session does not exist');
  } else if (transaction_result.action === 'add_session') {
    log('👉 User exist');
    log('👉 Session does not exist');
  } else if (transaction_result.action === 'update_session') {
    log('👉 User exist');
    log('👉 Session exist');
  }

  log('👉 Payload to send: ', transaction_result.firestore_data);

  if (!success) { return; }

  if (transaction_result.action === 'create_user') {
    log('🟢 User successfully created in Firestore, session successfully added to Firestore');
  } else if (transaction_result.action === 'add_session') {
    log('🟢 User already in Firestore, session successfully added to Firestore');
  } else if (transaction_result.action === 'update_session') {
    log('🟢 User already in Firestore, session successfully updated to Firestore');
  }
}


function get_firestore_failure_message(transaction_result) {
  if (!transaction_result || !transaction_result.action) {
    return '🔴 Firestore request failed';
  }

  if (transaction_result.action === 'create_user') {
    return '🔴 User or session data not created to Firestore';
  }

  if (transaction_result.action === 'add_session') {
    return '🔴 User or session data not added to Firestore';
  }

  return '🔴 User or session data not updated to Firestore';
}


// Set user cookie
function set_cookie(cookie_name, cookie_value, max_age) {
  const cookie_domain = '.' + computeEffectiveTldPlusOne(request_origin);
  const cookie_path = '/';
  const cookie_secure = true;
  const sameSite = "Strict";
  const httpOnly = true;

  const cookie_options = {
    domain: cookie_domain,
    path: cookie_path,
    secure: cookie_secure,
    sameSite: sameSite,
    'max-age': max_age,
    httpOnly: httpOnly
  };

  setCookie(cookie_name, cookie_value, cookie_options);
}


// --------------------------------------------------------------------------------------------------------------
// SEND DATA TO GOOGLE BIGQUERY
// --------------------------------------------------------------------------------------------------------------

function send_to_bq(event_data) {
  const payload_copy = JSON.parse(JSON.stringify(event_data));

  if (data.enable_logs) {log('👉 Payload to send: ', payload_copy);}

  // Encode data for Google BigQuery
  encode_data(payload_copy, 'user_data');
  encode_data(payload_copy, 'session_data');
  encode_data(payload_copy, 'page_data');
  encode_data(payload_copy, 'event_data');
  encode_data(payload_copy, 'consent_data');
  encode_data(payload_copy, 'gtm_data');
  payload_copy.datalayer = (payload_copy.datalayer) ? JSON.stringify(payload_copy.datalayer) : null;
  payload_copy.ecommerce = (payload_copy.ecommerce) ? JSON.stringify(payload_copy.ecommerce) : null;

  // Google BigQuery project settings
  const project = {
    projectId: data.bq_project_id,
    datasetId: data.bq_dataset_id,
    tableId: data.bq_table_id
  };

  // Google BigQuery write options
  const options = {
    skipInvalidRows: false,
    ignoreUnknownValues: false
  };

  // Send data to Google BigQuery
  return BigQuery.insert(
    project,
    [payload_copy],
    options
  ).then(
    // REQUEST SUCCESS
    () => {
      if (data.enable_logs) {log('🟢 Payload data inserted successfully into BigQuery');}

      return {
        status: true,
        status_code: 200,
        message: '🟢 Payload data inserted successfully into BigQuery'
      };
    },
    // REQUEST ERROR
    (errors) => {
      if (data.enable_logs) {log('🔴 Payload data not inserted into BigQuery');}
      if (data.enable_logs) {log(errors);}

      return {
        status: false,
        status_code: 500,
        message: '🔴 Payload data not inserted into BigQuery'
      };
    }
  );
}


// Encode event data
function encode_data(bq_event_data, prop) {
  if (bq_event_data[prop] && Object.keys(bq_event_data[prop]).length > 0) {
    var mapped_data = [];
    Object.keys(bq_event_data[prop]).forEach((key) => {
      var temp_data = {};
      // Is string 
      if (getType(bq_event_data[prop][key]) === 'string') {
        temp_data.name = key;
        temp_data.value = { string: bq_event_data[prop][key] || null };
        // Is number (integer or float)    
      } else if (getType(bq_event_data[prop][key]) === 'number') {
        if (bq_event_data[prop][key] % 1 !== 0) {
          temp_data.name = key;
          temp_data.value = { float: bq_event_data[prop][key] };
        } else {
          temp_data.name = key;
          temp_data.value = { int: bq_event_data[prop][key] };
        }
        // Is JSON (object or array) 
      } else if (getType(bq_event_data[prop][key]) === 'object' || getType(bq_event_data[prop][key]) === 'array') {
        temp_data.name = key;
        temp_data.value = { json: JSON.stringify(bq_event_data[prop][key]) };

        // Is null or undefined
      } else if (getType(bq_event_data[prop][key]) === 'null' || getType(bq_event_data[prop][key]) === 'undefined') {
        temp_data.name = key;
        temp_data.value = null;
        // Is boolean        
      } else if (getType(bq_event_data[prop][key]) === 'boolean') {
        temp_data.name = key;
        temp_data.value = { bool: bq_event_data[prop][key] };
      }
      mapped_data.push(temp_data);
    });
    bq_event_data[prop] = mapped_data;
  }
}


// --------------------------------------------------------------------------------------------------------------
// SEND DATA TO CUSTOM ENDPOINT
// --------------------------------------------------------------------------------------------------------------

function send_to_custom_endpoint(custom_request_endpoint_path, event_data) {
  if (data.enable_logs) {log('👉 Payload to send: ', event_data);}

  const request_options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  // Add custom headers
  if (data.add_custom_request_headers) {
    const custom_request_headers = data.custom_request_headers;

    if (custom_request_headers !== undefined) {
      for (var i = 0; i < custom_request_headers.length; i++) {
        const header_name = custom_request_headers[i].header_name;
        const header_value = custom_request_headers[i].header_value;

        request_options.headers[header_name] = header_value;
      }
    }
  }

  // Send to custom endpoint
  return sendHttpRequest(
    custom_request_endpoint_path,
    request_options,
    JSON.stringify(event_data)
  ).then(
    (result) => {
      // REQUEST SUCCESS
      if (result.statusCode >= 200 && result.statusCode < 300) {
        if (data.enable_logs) {
          log('🟢 Request sent successfully to:', custom_request_endpoint_path);}

        return {
          status: true,
          status_code: result.statusCode,
          message: '🟢 Request sent successfully to custom endpoint'
        };
      }

      // HTTP ERROR
      if (data.enable_logs) {log('🔴 Request not sent successfully. Error:', result);}

      return {
        status: false,
        status_code: result.statusCode,
        message: '🔴 Request not sent successfully to custom endpoint'
      };
    },
    // REQUEST ERROR
    (error) => {
      if (data.enable_logs) {log('🔴 Request not sent successfully. Error:', error);}

      return {
        status: false,
        status_code: null,
        message: '🔴 Request not sent successfully to custom endpoint'
      };
    }
  );
}
