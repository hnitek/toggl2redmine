'use strict';

/**
 * Toggl 2 Redmine Helper.
 */
var T2R = T2R || {};

/**
 * Redmine Base URL.
 *
 * @type {string}
 */
T2R.REDMINE_URL = '';

/**
 * Redmine API Key.
 *
 * @type {string}
 */
T2R.REDMINE_API_KEY = T2R.REDMINE_API_KEY || false;

/**
 * Toggl API Key.
 *
 * @type {string}
 */
T2R.TOGGL_API_KEY = T2R.TOGGL_API_KEY || false;

/**
 * Cached data.
 *
 * @type {Object}
 */
T2R.cacheData = {};

/**
 * Local storage data.
 *
 * @type {Object}
 */
T2R.storageData = {};

/**
 * This is where it starts.
 */
T2R.initialize = function () {
  T2R.initFilterForm();
  T2R.initPublishForm();
};

/**
 * Get or set objects from or to the local storage.
 *
 * @param {string} key
 *   Storage key.
 *
 * @param {*} value
 *   Storage value. Ignore this argument for "get" requests.
 *
 * @returns {*}
 *   Stored value if found.
 */
T2R.storage = function (key, value) {
  var output = null;

  // Set data.
  if (2 === arguments.length) {
    T2R.storageData[key] = value;
    output = value;
  }
  // Get data.
  else {
    if ('undefined' !== typeof T2R.storageData[key]) {
      output = T2R.storageData[key];
    }
  }

  return output;
};

/**
 * Get or set objects from or to the cache.
 *
 * @param {string} key
 *   Cache key.
 *
 * @param {*} value
 *   Cache value. Ignore this argument for "get" requests.
 *
 * @returns {*}
 *   Cached value if found.
 */
T2R.cache = function (key, value = null) {
  if (2 === arguments.length) {
    T2R.cacheData[key] = value;
    return value;
  }
  else {
    return ('undefined' === typeof T2R.cacheData[key])
      ? null : T2R.cacheData[key];
  }
};

/**
 * Filter form initializer.
 */
T2R.initFilterForm = function() {
  // Populate current date on date fields.
  $('#filter-form #date').each(function() {
    var date = new Date();
    date = date.toISOString();
    this.value = date.substr(0, 10);
  });

  // Handle filter form submission.
  $('#filter-form').submit(T2R.handleFilterForm).trigger('submit');
};

/**
 * Filter form submission handler.
 */
T2R.handleFilterForm = function() {
  T2R.storage('date', $('input#date').val());
  setTimeout(function() {
    T2R.updateRedmineReport();
    T2R.updateTogglReport();
  }, 100);

  // Unlock the publish form if it was previously locked.
  T2R.unlockPublishForm();

  return false;
};

/**
 * Publish form initializer.
 */
T2R.initPublishForm = function () {
  $('#publish-form').submit(T2R.handlePublishForm);
};

/**
 * Locks the publish form.
 *
 * This disallows the user to submit the form.
 */
T2R.lockPublishForm = function () {
  $('#publish-form #btn-publish').attr('disabled', 'disabled');
};

/**
 * Unlocks the publish form.
 *
 * This allows the user to submit it.
 */
T2R.unlockPublishForm = function () {
  $('#publish-form #btn-publish').removeAttr('disabled');
};

/**
 * Publish form submission handler.
 */
T2R.handlePublishForm = function() {
  if (confirm('This action cannot be undone. Do you really want to continue?')) {
    setTimeout(T2R.publishToRedmine);
  }
  return false;
};

/**
 * Publishes selected Toggl data to Redmine.
 */
T2R.publishToRedmine = function () {
  T2R.lockPublishForm();

  // Check for eligible entries.
  var $checkboxes = $('#toggl-report tbody tr input.cb-import');
  if ($checkboxes.filter(':checked').length <= 0) {
    alert('Please select the entries which you want to import into Redmine.');
    T2R.unlockPublishForm();
    return;
  }

  // Post eligible entries to Redmine.
  $('#toggl-report tbody tr').each(function () {
    var $tr = $(this);
    var $checkbox = $tr.find('input.cb-import');

    // If the item is not marked for import, ignore it.
    if (!$checkbox.prop('checked')) {
      return;
    }

    // Prepare the data to be pushed to Redmine.
    var entry = {
      spent_on: T2R.storage('date'),
      issue_id: $tr.find('[data-property="issue_id"]').val(),
      comments: $tr.find('[data-property="comments"]').val(),
      activity_id: $tr.find('[data-property="activity_id"]').val(),
      hours: $tr.find('[data-property="hours"]').val(),
      user_id: 1
    };

    // Push the data to Redmine.
    T2R.redmineRequest({
      async: false,
      url: '/time_entries.json',
      method: 'post',
      context: $tr,
      data: {
        time_entry: entry
      },
      dataType: 'json',
      success: function(data, status, xhr) {
        var $tr = $(this);
        $tr.addClass('t2r-success');
        $checkbox.removeAttr('checked');
        $tr.find(':input').attr('disabled', 'disabled');
      },
      error: function(data, status, xhr) {
        var $tr = $(this);
        $tr.addClass('t2r-error');
        console.log("Error: Couldn't log '" + entry.issue_id + ': ' + entry.comments + "'");
      }
    });
  });

  // Refresh the Redmine report and show success message.
  alert('Yay! The selected time entries were posted to Redmine!');
  T2R.updateRedmineReport();
};

/**
 * Refresh the Toggl report table.
 */
T2R.updateTogglReport = function () {
  var opts = T2R.getTimeRange();
  var entries = T2R.getNormalizedTogglTimeEntries(opts);

  // Render the entries on the table.
  var $table = $('#toggl-report').addClass('t2r-loading');
  $table.find('tbody').html('');

  // Display entries eligible for export.
  for (var key in entries) {
    var entry = entries[key];
    if (!entry.issueId) {
      continue;
    }
    var markup = T2RRenderer.render('TogglRow', entry);
    $table.find('tbody').append(markup);
  }

  // Display entries not eligible for export.
  for (var key in entries) {
    var entry = entries[key];
    if (entry.issueId) {
      continue;
    }
    var markup = T2RRenderer.render('TogglRow', entry);
    $table.find('tbody').append(markup);
  }

  // Display empty table message, if required.
  if (0 === entries.length) {
    var markup = '<tr><td colspan="' + $table.find('thead tr:first th').length + '">'
        + 'There are no items to display here. Did you log your time on Toggl?'
      + '</td></tr>';
    $table.find('tbody').append(markup);
  }

  // Remove loader.
  $table.removeClass('t2r-loading');
};

/**
 * Gets time range as per "date" filter.
 */
T2R.getTimeRange = function () {
  var date = T2R.storage('date');
  return {
    from: date + ' 00:00:00',
    till: date + ' 23:59:59'
  };
};

/**
 * Returns basic auth headers for the username:password combination.
 *
 * @param {string} username
 *   The username.
 * @param {string} password
 *   The password.
 *
 * @returns object
 *   Basic auth headers.
 */
T2R.getBasicAuthHeader = function (username, password) {
  var userpass = username + ':' + password;
  return {
    Authorization: 'Basic ' + btoa(userpass)
  };
};

/**
 * Converts a date string into a Date object.
 * @param {string} string
 *   The string to parse as a date.
 * @param {boolean} removeTzOffset
 *   Whether to cancel the local timezone offset.
 *
 * @returns {Date}
 *   The date as an object.
 */
T2R.dateStringToObject = function (string, removeTzOffset = false) {
  try {
    string = Date.parse(string);
    var object = new Date(string);
    // Handle timezone offset to get proper ISO date.
    if (removeTzOffset) {
      var offset = object.getTimezoneOffset();
      object = new Date(object.getTime() + offset * 60 * 1000);
    }
    return object;
  }
  catch (e) {
    return false;
  }
};

/**
 * Sends an AJAX request to Toggl with the given options.
 *
 * Automatically injects auth headers.
 *
 * @param opts
 *   Request options.
 */
T2R.togglRequest = function (opts) {
  opts = opts || {};

  // Add auth headers.
  opts.headers = opts.headers || {};
  $.extend(opts.headers, T2R.getBasicAuthHeader(T2R.TOGGL_API_KEY, 'api_token'));

  $.ajax(opts);
};

/**
 * Retrieves raw time entry data from Toggl.
 *
 * @param opts
 *   Applied filters.
 *
 * @returns {Object|boolean}
 *   Data on success or false otherwise.
 */
T2R.getTogglTimeEntries = function (opts) {
  opts = opts || {};

  opts.start_date = T2R.dateStringToObject(opts.from, true);
  if (!opts.start_date) {
    alert('Error: Invalid start date!');
    return false;
  }
  opts.start_date = opts.start_date.toISOString();

  opts.end_date = T2R.dateStringToObject(opts.till, true);
  if (!opts.end_date) {
    alert('Error: Invalid end date!');
    return false;
  }
  opts.end_date = opts.end_date.toISOString();

  var output = false;
  T2R.togglRequest({
    async: false,
    url: 'https://www.toggl.com/api/v8/time_entries',
    data: {
      start_date: opts.start_date,
      end_date: opts.end_date
    },
    success: function(data, status, xhr) {
      output = data;
    }
  });

  return output;
};

/**
 * Retrieves normalized time entry data from Toggl.
 *
 * @param opts
 *   Applied filters.
 *
 * @returns {Object|boolean}
 *   Data on success or false otherwise.
 */
T2R.getNormalizedTogglTimeEntries = function (opts) {
  opts = opts || {};

  var entries = T2R.getTogglTimeEntries(opts) || {};
  var output = {};
  var issueIds = [];

  for (var i in entries) {
    var record = {
      duration: 0,
      // Todo: Track original Toggl ID.
      togglEntryId: [],
      togglEntry: []
    };
    var entry = entries[i];

    entry.description = entry.description || '';
    var match = entry.description.match(/^.*#(\d+) (.*)$/);
    if (match) {
      record.issueId = parseInt(match[1]);
      record.comments = match[2];
    }
    else {
      record.issueId = false;
      record.comments = entry.description;
    }

    // Unique key for the record.
    record.key = record.issueId + ':' + record.comments;
    record.duration = entry.duration;

    // Ignore active timers.
    if (record.duration < 0) {
      console.log('The active time entry was skipped.');
      continue;
    }

    // Collect this issue ID.
    if (record.issueId && issueIds.indexOf(record.issueId) < 0) {
      issueIds.push(record.issueId);
    }

    // Create record if not exists.
    if ('undefined' === typeof output[record.key]) {
      output[record.key] = record;
    }
    // Update record if exists.
    else {
      output[record.key].duration += record.duration;
    }
  }

  // Further massaging and refinements.
  var issues = T2R.getRedmineIssues(issueIds);
  for (var i in output) {
    var record = output[i];

    // Include "hours" in Redmine format.
    record.hours = (record.duration / 3600).toFixed(2);

    // Attach issue data.
    if (record.issueId !== false && 'undefined' !== typeof issues[record.issueId]) {
      var issue = issues[record.issueId];
      record.subject = issue ? issue.subject : false;
      record.project = issue ? issue.project.name : false;
    }
    else {
      record.subject = false;
      record.project = false;
    }
  }

  return output;
};

/**
 * Retrieves raw time entry data from Redmine.
 *
 * @param opts
 *   Applied filters.
 *
 * @returns {Object|boolean}
 *   Data on success or false otherwise.
 */
T2R.getRedmineTimeEntries = function (opts) {
  opts = opts || {};
  var output = [];
  try {
    T2R.redmineRequest({
      async: false,
      method: 'get',
      url: '/time_entries.json',
      data: {
        spent_on: opts.from + '|' + opts.till,
        user_id: 'me',
        include: 'issue'
      },
      success: function (data, status, xhr) {
        output = 'undefined' !== typeof data.time_entries
          ? data.time_entries : [];
      }
    });
  } catch (e) {
    output = [];
  }
  return output;
};

/**
 * Retrieves normalized time entry data from Redmine.
 *
 * @param opts
 *   Applied filters.
 *
 * @returns {Object|boolean}
 *   Data on success or false otherwise.
 */
T2R.getNormalizedRedmineTimeEntries = function (opts) {
  opts = opts || {};

  var entries = T2R.getRedmineTimeEntries(opts);
  var output = {};
  var issueIds = [];

  for (var i in entries) {
    var entry = entries[i];

    // Ensure an issue ID.
    entry.issue = entry.issue ? entry.issue : { id: false };

    // Generate duration in seconds.
    entry.duration = Math.floor(parseFloat(entry.hours) * 3600);

    // Collect issue IDs.
    if (issueIds.indexOf(entry.issue.id) < 0) {
      issueIds.push(entry.issue.id);
    }
  }

  // Add issue subjects to all entries.
  var issues = T2R.getRedmineIssues(issueIds);
  for (var i in entries) {
    var entry = entries[i];
    if (entry.issue.id && 'undefined' !== typeof issues[entry.issue.id]) {
      var issue = issues[entry.issue.id];
      if (issue) {
        entry.issue = issue;
      }

      // Include the entry in the output.
      output[entry.id] = entry;
    }
  }

  return output;
}

/**
 * Updates the Redmine time entry report.
 */
T2R.updateRedmineReport = function () {
  // Determine Redmine API friendly date range.
  var till = T2R.storage('date');
  till = T2R.dateStringToObject(till, true);
  var from = new Date();
  from.setDate(till.getDate() - 1);

  // Fetch time entries from Redmine.
  var opts = {
    from: from.toISOString().split('T')[0],
    till: till.toISOString().split('T')[0]
  };
  var entries = T2R.getNormalizedRedmineTimeEntries(opts) || [];

  // Render the entries on the table.
  var $table = $('#redmine-report').addClass('t2r-loading');
  $table.find('tbody').html('');

  // Display entries from Redmine.
  for (var key in entries) {
    var entry = entries[key];
    var markup = T2RRenderer.render('RedmineRow', entry);
    $table.find('tbody').append(markup);
  }

  // Display empty table message, if required.
  if (0 === entries.length) {
    var markup = '<tr><td colspan="' + $table.find('thead tr:first th').length + '">'
      + 'There are no items to display here.'
      + '</td></tr>';
    $table.find('tbody').html(markup);
  }

  // Remove loader.
  $table.removeClass('t2r-loading');
};

/**
 * Gets a list of Redmine time entry activities.
 *
 * @returns {Object}
 *   Activities indexed by ID.
 */
T2R.getRedmineActivities = function () {
  var key = 'redmine.activities';
  if (!T2R.cache(key)) {
    T2R.redmineRequest({
      async: false,
      url: '/enumerations/time_entry_activities.json',
      success: function (data, status, xhr) {
        T2R.cache(key, data.time_entry_activities);
      },
      error: function (data, status, xhr) {
        T2R.cache(key, []);
      }
    });
  }
  return T2R.cache(key);
};

/**
 * Fetches data about a given Redmine issue.
 *
 * @param id
 *   Redmine issue ID.
 *
 * @returns {Object|boolean}
 *   Redmine issue data on success or false otherwise.
 */
T2R.getRedmineIssue = function (id) {
  var output = T2R.getRedmineIssues([id]);
  return ('undefined' == typeof output[id]) ? false : output[id];
}

/**
 * Fetches data about multiple Redmine issues.
 *
 * @param {Array} id
 *   Redmine issue IDs.
 *
 * @returns {Object|boolean}
 *   Redmine issues indexed by ID or false otherwise.
 */
T2R.getRedmineIssues = function (ids) {
  var output = {};
  // Do nothing if no IDs are sent.
  if (0 === ids.length) {
    return output;
  }
  // Fetch issue info and key them by issue ID.
  try {
    T2R.redmineRequest({
      async: false,
      cache: true,
      timeout: 1000,
      url: '/issues.json',
      data: {
        issue_id: ids.join(',')
      },
      success: function (data, status, xhr) {
        var issues = ('undefined' === data.issues) ? [] : data.issues;
        for (var i in issues) {
          var issue = issues[i];
          output[issue.id] = issue;
        }
      },
      error: function (data, status, xhr) {}
    });
  } catch(e) {
    console.log('Error: ' + e);
  }
  return output;
};

/**
 * Returns CSRF Token data generated by Redmine.
 *
 * @returns object
 *   An object containing "param" and "token".
 */
T2R.getRedmineCsrfToken = function () {
  var key = 'redmine.token';
  var output = T2R.cache(key);
  if (!output) {
    // Redmine issues CSRF tokens as META elements on the page.
    var $param = $('meta[name="csrf-param"]');
    var $token = $('meta[name="csrf-token"]');
    if ($param.length === 1 && $token.length === 1) {
      output = {
        param: $param.attr('content'),
        token: $token.attr('content')
      };
      T2R.cache(key, output);
    }
  }
  return output;
};

/**
 * Sends an AJAX request to Redmine with the given options.
 *
 * Automatically injects auth headers.
 *
 * @param opts
 *   Request options.
 */
T2R.redmineRequest = function (opts) {
  opts.timeout = opts.timeout || 3000;
  opts.url = T2R.REDMINE_URL + opts.url;

  // TODO: Use CSRF Token instead of API Key?
  // For some reason Redmine throws 401 Unauthroized despite a CSRF Token.
  opts.headers = {
    'X-Redmine-API-Key': T2R.REDMINE_API_KEY
  };
  $.ajax(opts);
};

/**
 * Toggl em Red Renderer.
 */
var T2RRenderer = {};

T2RRenderer.renderDropdown = function (data) {
  var $el = $('<select />');
  if ('undefined' !== typeof data.placeholder) {
    $el.append('<option value="">' + data.placeholder + '</option>');
  }
  if ('undefined' !== typeof data.attributes) {
    $el.attr(data.attributes);
  }
  for (var value in data.options) {
    var label = data.options[value];
    $el.append('<option value="' + value + '">' + label + '</option>');
  }
  return $('<div />').append($el).html();
};

T2RRenderer.renderRedmineActivityDropdown = function (data) {
  data = data || {};
  data.options = {};
  var activities = T2R.getRedmineActivities();
  for (var i in activities) {
    var activity = activities[i];
    data.options[activity.id] = activity.name;
  }
  return T2RRenderer.render('Dropdown', data);
};

T2RRenderer.renderDuration = function (data) {
  data = Math.ceil(data / 60);
  var h = Math.floor(data / 60);
  var output = h;
  var m = data % 60;
  output += ':' + ('00' + m).substr(-2);
  return output;
};

T2RRenderer.renderTogglRow = function (data) {
  var issueUrl = data.issueId ? '/issue/' + data.issueId : '#';

  var markup = '<tr>'
    + '<td class="checkbox"><input class="cb-import" type="checkbox" value="1" /></td>'
    + '<td class="id">'
      + '<input data-property="issue_id" type="hidden" value="' + data.issueId + '" />'
      + (data.issueId ? '<a href="' + issueUrl + '" target="_blank">' + data.issueId + '</a>' : '-')
    + '</td>'
    + '<td class="subject">'
      + (data.project || 'Unknown') + ': ' + (data.subject || 'Unknown')
    + '</td>'
    + '<td class="comments"><input data-property="comments" type="text" value="' + data.comments + '" maxlength="255" /></td>'
    + '<td class="activity">' + T2RRenderer.render('RedmineActivityDropdown', {
      placeholder: '-',
      attributes: {
        'data-property': 'activity_id',
        'required': 'required'
      }
    }) + '</td>'
    + '<td class="hours"><input data-property="hours" type="hidden" value="' + data.hours + '" maxlength="5" />' + T2RRenderer.render('Duration', data.duration) + '</td>'
    + '</tr>';

  // If the entry is invalid, disable it.
  var $tr = $(markup);
  if (!data.issueId || !data.subject) {
    $tr.addClass('t2r-error');
    $tr.find(':input').attr({
      'disabled': 'disabled'
    });
  }

  return $('<div />').append($tr).html();
};

T2RRenderer.renderRedmineRow = function (data) {
  var issueUrl = data.issue.id ? '/issue/' + data.issue.id : '#';
  var markup = '<tr>'
    + '<td class="id">'
      + '<input data-property="issue_id" type="hidden" value="' + data.issue.id + '" />'
      + (data.issue.id ? '<a href="' + issueUrl + '" target="_blank">' + data.issue.id + '</a>' : '-')
    + '</td>'
    + '<td class="subject">'
      + (data.project.name || 'Unknown') + ': ' + (data.issue.subject || 'Unknown')
    + '</td>'
    + '<td class="comments">' + data.comments + '</td>'
    + '<td class="activity">' + data.activity.name + '</td>'
    + '<td class="hours">' + T2RRenderer.render('Duration', data.duration) + '</td>'
    + '</tr>';
  var $tr = $(markup);
  if (!data.issueId) {
    $tr.addClass('error');
    $tr.find(':input').attr({
      'disabled': 'disabled'
    });
  }
  return $('<div />').append($tr).html();
};

/**
 * Renders data with a mentioned template.
 *
 * @param {string} template
 *   Template ID.
 * @param {*} data
 *   The data to render.
 *
 * @returns {string}
 *   Rendered output.
 */
T2RRenderer.render = function (template, data) {
  var method = 'render' + template;
  if ('undefined' == typeof T2RRenderer) {
    throw 'Error: To render "' + template + '" please define "T2RRenderer.' + method;
  }
  return T2RRenderer[method](data);
};

/**
 * Init script.
 */
$(document).ready(function() {
  T2R.initialize();
});