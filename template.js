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
  event_data.event_data.channel_grouping = get_channel_grouping(event_data_obj.source, event_data_obj.campaign);
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

function get_channel_grouping(source, campaign) {
  const patterns = {
    search_engine: createRegex('360\\.cn|alice|aol|ar\\.search\\.yahoo\\.com|ask|bing|google|yahoo|yandex|baidu|ecosia|duckduckgo|sogou|naver|seznam', 'i'),
    social: createRegex('facebook|twitter|t\\.co|bsky\\.app|instagram|pinterest|linkedin|reddit|vk\\.com|tiktok|snapchat|tumblr|wechat|whatsapp', 'i'),
    shopping: createRegex('amazon|ebay|etsy|shopify|stripe|walmart|mercadolibre|alibaba|naver\\.shopping', 'i'),
    video: createRegex('youtube|vimeo|netflix|twitch|dailymotion|hulu|disneyplus|wistia|youku', 'i'),
    ai: createRegex('chatgpt|gemini|bard|claude|alexa|siri|assistant|\\.ai([/]|$)', 'i'),
    email: createRegex('email|e-mail|newsletter|mailchimp|sendgrid|sparkpost', 'i')
  };

  // if (!source) return 'internal_traffic';
  // if (source === 'direct') return 'direct';
  if (!source || source === 'direct') return 'direct';
  if (source === 'tagassistant.google.com') return 'gtm_debugger';
  if (testRegex(patterns.ai, source)) return 'ai';
  if (testRegex(patterns.search_engine, source)) return campaign ? 'paid_search_engine' : 'organic_search_engine';
  if (testRegex(patterns.social, source)) return campaign ? 'paid_social' : 'organic_social';
  if (testRegex(patterns.shopping, source)) return campaign ? 'paid_shopping' : 'organic_shopping';
  if (testRegex(patterns.video, source)) return campaign ? 'paid_video' : 'organic_video';
  if (testRegex(patterns.email, source)) return 'email';

  if (!campaign) return 'referral';
  if (campaign) return 'affiliate';
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
