/**
 * Jquery plugin to render like contribution graph on Github.
 *
 * @see       {@link https://github.com/bachvtuan/Github-Contribution-Graph}
 * @author    bachvtuan@gmail.com
 * @license   MIT License
 * @since     0.1.0
 */

// Format string (expansion of string not recommended by eslint)
if (!String.prototype.formatString) {
  // eslint-disable-next-line no-extend-native
  String.prototype.formatString = function() {
    const args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) {
      return typeof args[number] !== "undefined"
        ? args[number]
        : match
      ;
    });
  };
}

(function ($) {
  $.fn.github_graph = function(options) {
    // If the number less than 10, add Zero before it
    const prettyNumber = function(number) {
      const result = number < 10 ? "0" + number.toString() : number = number.toString();
      return result;
    };
    const objTimestamp = {};

    /*
        Count the number on each day and store the object
        */
    const processListTimeStamp = function(listTimestamp) {
      // The result will store into this varriable

      for (let i = 0; i < listTimestamp.length; i++) {
        const _d = new Date(listTimestamp[i]);
        const displayDate = getDisplayDate(_d);
        if (!objTimestamp[displayDate]) {
          objTimestamp[displayDate] = 1;
        } else {
          objTimestamp[displayDate]++;
        }
      }
    };

    const getDisplayDate = function(dateObj) {
      const prettyMonth = prettyNumber(dateObj.getMonth() + 1);
      const prettyDate = prettyNumber(dateObj.getDate());
      return "{0}-{1}-{2}".formatString(dateObj.getFullYear(), prettyMonth, prettyDate);
    };

    const getCount = function(displayDate) {
      if (objTimestamp[displayDate]) {
        return objTimestamp[displayDate];
      }
      return 0;
    };

    const getColor = function(count) {
      if (count >= settings.colors.length) {
        return settings.colors[settings.colors.length - 1];
      }
      return settings.colors[count];
    };

    const start = function() {
      processListTimeStamp(settings.data);
      const wrapChart = _this;

      settings.colorsLength = settings.colors.length;


      let startDate;
      if (!settings.startDate) {
        // if set null, will get from 365 days from now
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 12);
      } else {
        startDate = settings.startDate;
      }


      for (let i = 0; i < 7; i++) {
        const day = startDate.getDay();
        if (day === 0) {
          // sunday
          break;
        } else {
          // Loop until get Sunday
          startDate.setDate(startDate.getDate() + 1);
        }
      }

      let loopHtml = "";

      // One year has 52 weeks
      const step = 13;

      const monthPosition = [];
      // var currentDate = new Date();
      monthPosition.push({ monthIndex: startDate.getMonth(), x: 0 });
      let usingMonth = startDate.getMonth();
      for (let i = 0; i < 52; i++) {
        const gx = i * step;
        let itemHtml = '<g transform="translate(' + gx.toString() + ',0)">';

        for (let j = 0; j < 7; j++) {
          // if ( startDate > currentDate ){
          //   //Break the loop
          //   break;
          // }
          const y = j * step;

          const monthInDay = startDate.getMonth();
          const dataDate = getDisplayDate(startDate);
          // Check first day in week
          if (j === 0 && monthInDay !== usingMonth) {
            usingMonth = monthInDay;
            monthPosition.push({ monthIndex: usingMonth, x: gx });
          }
          // move on to next day
          startDate.setDate(startDate.getDate() + 1);
          const count = getCount(dataDate);
          const color = getColor(count);

          itemHtml += '<rect class="day" width="11" height="11" y="' + y + '" fill="' + color + '" data-count="' + count + '" data-date="' + dataDate + '"/>';
        }

        itemHtml += "</g>";

        loopHtml += itemHtml;
      }


      // trick
      if (monthPosition[1].x - monthPosition[0].x < 40) {
        // Fix ugly graph by remove first item
        monthPosition.shift(0);
      }

      for (let i = 0; i < monthPosition.length; i++) {
        const item = monthPosition[i];
        const monthName =  settings.monthNames[item.month_index];
        loopHtml += '<text x="' + item.x + '" y="-5" class="month">' + monthName + "</text>";
      }

      // Add Monday, Wenesday, Friday label
      loopHtml += '<text text-anchor="middle" class="wday" dx="-10" dy="22">{0}</text>'.formatString(settings.h_days[0]) +
                        '<text text-anchor="middle" class="wday" dx="-10" dy="48">{0}</text>'.formatString(settings.h_days[1]) +
                        '<text text-anchor="middle" class="wday" dx="-10" dy="74">{0}</text>'.formatString(settings.h_days[2]);

      // Fixed size for now with width= 721 and height = 110
      const wireHtml =
            '<svg width="721" height="110" viewBox="0 0 721 110"  class="js-calendar-graph-svg">' +
              '<g transform="translate(20, 20)">' +
                loopHtml +
              "</g>" +
            "</svg>";

      wrapChart.html(wireHtml);

      // Mare sure off previous event
      /* $(document).off('mouseenter', _this.find('rect'), mouseEnter );
          $(document).off('mouseleave', _this.find('rect'), mouseLeave );
          $(document).on('mouseenter', _this.find('rect'), mouseEnter );
          $(document).on('mouseleave', _this.find('rect'), mouseLeave );
*/
      _this.find("rect").on("mouseenter", mouseEnter);
      _this.find("rect").on("mouseleave", mouseLeave);
      appendTooltip();
    };

    const mouseLeave = function(evt) {
      $(".svg-tip").hide();
    };

    // handle event mouseenter when enter into rect element
    const mouseEnter = function(evt) {
      const targetOffset = $(evt.target).offset();
      const count = $(evt.target).attr("data-count");
      const date = $(evt.target).attr("data-date");

      const countText = (count > 1) ? settings.texts[1] : settings.texts[0];
      const text = "{0} {1} on {2}".formatString(count, countText, date);

      const svgTip = $(".svg-tip").show();
      svgTip.html(text);
      const svgWidth = Math.round(svgTip.width() / 2 + 5);
      const svgHeight =  svgTip.height() * 2 + 10;

      svgTip.css({ top: targetOffset.top - svgHeight - 5 });
      svgTip.css({ left: targetOffset.left - svgWidth });
    };
    // Append tooltip to display when mouse enter the rect element
    // Default is display:none
    const appendTooltip = function() {
      if ($(".svg-tip").length === 0) {
        $("body").append('<div class="svg-tip svg-tip-one-line" style="display:none" ></div>');
      }
    };

    const settings = $.extend({
      // Default init settings.colors, user can override
      colors: ["#eeeeee", "#d6e685", "#8cc665", "#44a340", "#44a340"],
      start_date: null,
      // List of name months
      monthNames: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      h_days: ["M", "W", "F"],
      // Default is empty, it can be overrided
      data: []
    }, options);

    const _this = $(this);

    start();
  };
}(jQuery));
