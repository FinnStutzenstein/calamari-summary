(async function (doc) {

    const CREATE_DATE = "%%CREATE_DATE%%";

    Date.prototype.getWeek = function (dowOffset) {
        dowOffset = 1; //Monday
        var newYear = new Date(this.getFullYear(),0,1);
        var day = newYear.getDay() - dowOffset;
        day = (day >= 0 ? day : day + 7);
        var daynum = Math.floor((this.getTime() - newYear.getTime() - 
        (this.getTimezoneOffset()-newYear.getTimezoneOffset())*60000)/86400000) + 1;
        var weeknum;
        if(day < 4) {
            weeknum = Math.floor((daynum+day-1)/7) + 1;
            if(weeknum > 52) {
                nYear = new Date(this.getFullYear() + 1,0,1);
                nday = nYear.getDay() - dowOffset;
                nday = nday >= 0 ? nday : nday + 7;
                weeknum = nday < 4 ? 1 : 53;
            }
        }
        else {
            weeknum = Math.floor((daynum+day-1)/7);
        }
        return weeknum;
    };

    var $;

    async function request(url, data) {
        return $.ajax(`https://webcom.calamari.io/webapi/clockin/timesheet/${url}`, {
            data : JSON.stringify(data),
            contentType : "application/json",
            type : "POST",
            headers: {
                "x-csrf-token": /_csrf_token=(.*);?(.*)$/.exec(document.cookie)[1],
                "accept": "application/json",
                "x-requested-with": "XMLHttpRequest"
            },
            xhrFields: {
                withCredentials: true
            },
        });
    }

    async function main() {
        const leadingZero = x => ("0" + x.toString()).slice(-2);
        const fmtDate = x => `${x.getFullYear()}-${leadingZero(x.getMonth() + 1)}-${leadingZero(x.getDate())}`;

        const fmtStyles = stylesObject => Object.keys(stylesObject).map(s => `${s}: ${stylesObject[s]}`).join("; ")

        const existingDialog = $("#bladerunner")
        if (existingDialog) {
            existingDialog.remove();
        }

        $("#root").css("position", "relative");
        const mainStyles = {
            position: "absolute",
            left: "20em",
            top: "4em",
            "background-color": "lightgray",
            padding: "1em",
            "border-radius": "0.5em",
            "z-index": "10",
            "max-height": "80vh",
            "overflow-x": "hidden",
            "overflow-y": "scroll"
        }
        $("#root").append(`<div id="bladerunner" style="${fmtStyles(mainStyles)}"></div>`);
        const closeStyles = {
            position: "absolute",
            right: "0",
            top: "0",
            "background-color": "darkgray",
            display: "block",
            "border-radius": "20px",
            "line-height": "0.8em",
            "padding": "2px 4px 3px 4px",
            cursor: "pointer",
        }
        const dialog = $("#bladerunner");
        dialog.append(`<span id="bladerunner-close" style="${fmtStyles(closeStyles)}">x</span>`);
        $("#bladerunner-close").click(() => dialog.remove());

        const log = text => dialog.append(text ? `<p style="font-family: monospace;">${text}</p>` : "<br>");

        const employeeIdResponse = await request("get-data-frame", {dateRange: {range: "WEEK_CURRENT", shift: 0, from: null, to: null}, employees: [], teams: []})
        console.log("employeeIdResponse", employeeIdResponse);
        const employeeId = employeeIdResponse.employees[0];

        const employeeResponse = await request("get", {dateRange: {range: "WEEK_CURRENT", shift: 0, from: null, to: null}, employees: [employeeId]})

        const employee = employeeResponse.employees[0].employee;
        const firstWorkday = CREATE_DATE; // fmtDate(new Date(employee.createDate));
        log(`Zeiten f??r ${employee.fullName} (seit ${firstWorkday})`);

        const now = new Date(fmtDate(new Date()));
        const yesterday = (d => new Date(d.setDate(d.getDate() - 1)))(now);
        const lastMonday = (d => new Date(d.setDate(d.getDate() - d.getDay() + 1)))(now);
        const lastSunday = (d => new Date(d.setDate(d.getDate() - d.getDay())))(now);
        const nextSunday = (d => new Date(d.setDate(d.getDate() - d.getDay() + 7)))(now);
        const yesterdayFmt = fmtDate(yesterday);
        const lastMondayFmt = fmtDate(lastMonday);
        const lastSundayFmt = fmtDate(lastSunday);
        const nextSundayFmt = fmtDate(nextSunday);

        const response = await request("get", {dateRange: {range: "CUSTOM", shift: 0, from: firstWorkday, to: lastSundayFmt}, employees: [employee.id]});
        const worktime = {};
        const days = response.employees[0].days;
        days.forEach(day => {
            const d = new Date(day.date);
            const year = d.getFullYear().toString();
            const week = leadingZero(d.getWeek());
            if (!worktime[year]) {
                worktime[year] = {}
            }
            if (!worktime[year][week]) {
                worktime[year][week] = {
                    plannedSeconds: 0,
                    workedSeconds: 0,
                };
            }
            worktime[year][week].plannedSeconds += day.summary.plannedSeconds;
            worktime[year][week].workedSeconds += day.summary.workedSeconds;
        });

        const fmt = (seconds, isDiff) => {
            let sign = isDiff ? (seconds < 0 ? "-" : "+") : "";
            if (seconds < 0) {
                seconds *= -1;
            }
            const sec = seconds % 60;
            const min = Math.floor(seconds / 60) % 60;
            const hour = Math.floor(seconds / (60*60)) % 60;
            if (hour) {
                return `${sign}${hour}:${leadingZero(min)}h`;
            }
            if (min) {
                return `${sign}${min}:${leadingZero(sec)}m`;
            }
            return `${sign}${sec}s`;
        }
        const fmtDiff = (workedSeconds, plannedSeconds) => `${fmt(workedSeconds)}/${fmt(plannedSeconds)} (${fmt(workedSeconds - plannedSeconds, true)})`;

        const years = Object.keys(worktime).sort();
        let globalWorkedSeconds = 0;
        let globalPlannedSeconds = 0;
        years.forEach(year => {
            const weeks = Object.keys(worktime[year]).sort();
            log();
            log("### " + year);
            weeks.forEach(week => {
                const data = worktime[year][week];
                globalWorkedSeconds += data.workedSeconds;
                globalPlannedSeconds += data.plannedSeconds;
                log(`KW${week}: ${fmtDiff(data.workedSeconds, data.plannedSeconds)} ${fmt(globalWorkedSeconds - globalPlannedSeconds, true)}`);
            });
        });

        let secondsThisWeek = 0;
        if (yesterday >= lastMonday) {
            const currentWeekBeginningResponse = await request("get", {dateRange: {range: "CUSTOM", shift: 0, from: lastMondayFmt, to: yesterdayFmt}, employees: [employee.id]});
            secondsThisWeek = currentWeekBeginningResponse.employees[0].summary.workedSeconds;
        }

        const currentWeekResponse = await request("get", {dateRange: {range: "CUSTOM", shift: 0, from: lastMondayFmt, to: nextSundayFmt}, employees: [employee.id]});
        const plannedThisWeek = currentWeekResponse.employees[0].summary.plannedSeconds;
        log();
        log(`Diese Woche: ${fmtDiff(secondsThisWeek, plannedThisWeek)} (ohne den aktuellen Tag)`);
        dialog.scrollTop(dialog[0].scrollHeight);
    }
    
    const jQueryScript = document.createElement('script');
    jQueryScript.src = 'https://code.jquery.com/jquery-latest.min.js';
    jQueryScript.onload = () => {
        $ = jQuery;
        main().catch(err => console.error(err));
    };
    doc.body.appendChild(jQueryScript);
})(document);
