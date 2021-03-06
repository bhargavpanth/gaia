'use strict';

var AdvancedSettings = require('./views/advanced_settings'),
    Day = require('./views/day'),
    EditEvent = require('./views/edit_event'),
    Marionette = require('marionette-client'),
    Month = require('./views/month'),
    MonthDay = require('./views/month_day'),
    ReadEvent = require('./views/read_event'),
    Week = require('./views/week');

function Calendar(client) {
  this.client = client.scope({ searchTimeout: 5000 });
  this.actions = new Marionette.Actions(this.client);

  // Initialize our view remotes.
  this.advancedSettings = new AdvancedSettings(client);
  this.day = new Day(client);
  this.editEvent = new EditEvent(client);
  this.month = new Month(client);
  this.monthDay = new MonthDay(client);
  this.readEvent = new ReadEvent(client);
  this.week = new Week(client);
}
module.exports = Calendar;

Calendar.ORIGIN = 'app://calendar.gaiamobile.org';

Calendar.prototype = {
  launch: function(opts) {
    this.client.apps.launch(Calendar.ORIGIN);
    this.client.apps.switchToApp(Calendar.ORIGIN);

    // Wait for the document body to know we're really 'launched'.
    this.client.helper.waitForElement('body');

    if (opts) {
      if (opts.hideSwipeHint) {
        this.client.helper
          .waitForElement('#hint-swipe-to-navigate')
          .click();
      }
    }
  },

  get addEventButton() {
    return this.client.findElement('#time-header a[href="/event/add/"]');
  },

  get headerContent() {
    return this.client.findElement('#current-month-year');
  },

  openAdvancedSettingsView: function() {
    // TODO(gareth)
  },

  openDayView: function() {
    this.client
      .findElement('#view-selector a[href="/day/"]')
      .click();
    this.day.waitForDisplay();
    return this;
  },

  openMonthView: function() {
    this.client
      .findElement('#view-selector a[href="/month/"]')
      .click();
    this.month.waitForDisplay();
    return this;
  },

  openWeekView: function() {
    this.client
      .findElement('#view-selector a[href="/week/"]')
      .click();
    this.week.waitForDisplay();
    return this;
  },

  clickToday: function() {
    this.client
      .findElement('#view-selector a[href="#today"]')
      .click();
    return this;
  },

  /**
   * Create an event.
   *
   * Options:
   *   (String) title - event title.
   *   (String) location - event location.
   *   (Date) startDate - event start date.
   *   (Date) endDate - event end date.
   *   (Number) startHour - shortcut for creating an event that starts today.
   *   (Number) duration - length of event in hours.
   *   (Array) reminders - array of strings like '5 minutes before'.
   */
  createEvent: function(opts) {
    var startDate;
    if (opts.startDate) {
      startDate = opts.startDate;
    } else {
      startDate = new Date();
      // startHour can be zero!
      if (opts.startHour != null) {
        startDate.setHours(opts.startHour, 0, 0, 0);
      }
    }

    var endDate;
    if (opts.endDate) {
      endDate = opts.endDate;
    } else {
      // 1h by default
      var duration = opts.duration || 1;
      endDate = new Date(startDate.getTime() + duration * 60 * 60 * 1000);
    }

    this.addEventButton.click();
    var editEvent = this.editEvent;
    editEvent.waitForDisplay();
    editEvent.title = opts.title;
    editEvent.location = opts.location || '';
    editEvent.description = opts.description || '';
    editEvent.startDate = startDate;
    editEvent.startTime = startDate;
    editEvent.endDate = endDate;
    editEvent.endTime = endDate;
    editEvent.reminders = opts.reminders || [];
    editEvent.save();

    this.waitForKeyboardHide();
    editEvent.waitForHide();
    return this;
  },

  /**
   * Tests if content is bigger than container. If something is wrong it
   * throws errors.
   */
  checkOverflow: function(element, msg) {
    msg = msg ? msg + ': ' : '';

    var wid = element.scriptWith(function(el) {
      return {
        content: el.scrollWidth,
        container: el.clientWidth
      };
    });
    if (!wid.content) {
      throw new Error(msg + 'invalid content width');
    }
    if (!wid.container) {
      throw new Error(msg + 'invalid container width');
    }
    // we use a buffer of 1px to account for potential rounding issues
    // see: Bug 959901
    if (Math.abs(wid.content - wid.container) > 1) {
      msg += 'content (' + wid.content + 'px) is wider than container (' +
        wid.container + 'px)';
      throw new Error(msg);
    }

    return this;
  },

  // TODO: extract this logic into the marionette-helper repository since this
  // can be useful for other apps as well
  waitForKeyboardHide: function() {
    // FIXME: keyboard might affect the click if test is being executed on
    // a slow machine (eg. travis-ci) so we do this hack until Bug 965131 is
    // fixed
    var client = this.client;

    // need to go back to top most frame before being able to switch to
    // a different app!!!
    client.switchToFrame();
    client.apps.switchToApp('app://keyboard.gaiamobile.org');
    client.waitFor(function() {
      return client.executeScript(function() {
        return document.hidden;
      });
    });

    client.switchToFrame();
    client.apps.switchToApp(Calendar.ORIGIN);
    return this;
  },

  formatDate: function(date) {
    var month = date.getMonth() + 1,
        day = date.getDate(),
        year = date.getFullYear();
    if (month.toString().length === 1) {
      month = '0' + month;
    }
    if (day.toString().length === 1) {
      day = '0' + day;
    }

    return [month, day, year].join('/');
  },

  swipeLeft: function() {
    return this._swipe({ direction: 'left' });
  },

  swipeRight: function() {
    return this._swipe({ direction: 'right' });
  },

  /**
   * Options:
   *   (String) direction is one of 'left', 'right'.
   */
  _swipe: function(options) {
    var bodySize = this.client.executeScript(function() {
      return {
        height: document.body.clientHeight,
        width: document.body.clientWidth
      };
    });

    // (x1, y1) is swipe start.
    // (x2, y2) is swipe end.
    var x1, x2, y1, y2;
    y1 = y2 = bodySize.height * 0.2;
    if (options.direction === 'left') {
      x1 = bodySize.width * 0.2;
      x2 = 0;
    } else if (options.direction === 'right') {
      x1 = bodySize.width * 0.8;
      x2 = bodySize.width;
    } else {
      throw new Error('swipe needs a direction');
    }

    var body = this.client.findElement('body');
    this.actions
      .flick(body, x1, y1, x2, y2)
      .perform();
    return this;
  }
};
