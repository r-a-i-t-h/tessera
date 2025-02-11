/*
    1.1.1
*/

var date_help = {
    now: _ => new Date(),
    today: _ => new Date((new Date()).toDateString()),
    parse: date_string => new Date(date_string),
    day_names_short: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    day_names_long: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    month_names_short: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    month_names_long: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    display: function (d, short_names = false, include_year = false) {
        return `${(short_names ? this.day_names_short : this.day_names_long)[d.getDay()]} ${d.getDate()} ${(short_names ? this.month_names_short : this.month_names_long)[d.getMonth()]}${include_year ? ` ${d.getFullYear()}` : ""}`;
    },
};

var body_switch = {
    sets: {
        font: ["fontA", "fontB", "fontC", "fontD"],
        theme: ["themeA", "themeB", "themeC", "themeD"],
    },
    switch: function (set, idx) {
        if (idx >= 0 && this.sets[set] && idx < this.sets[set].length) {
            document.body.classList.remove(...this.sets[set]);
            document.body.classList.add(this.sets[set][idx]);
        }
        return false;
    }
};

var env = {
    offline_mode: function (ren, msg) {
        return typeof (spa) != "undefined" && spa.using_cached_data ? msg : "";
    }
};
