/// <reference types="vite/client" />

import { el, text, setStyle } from "redom";

import localforage from "localforage";
import { extendPrototype } from "localforage-setitems";
extendPrototype(localforage);

import "@oddbird/popover-polyfill";

import ok_svg from "../assets/icons/ok.svg";
import todo_svg from "../assets/icons/todo.svg";
import close_svg from "../assets/icons/close.svg";
import add_svg from "../assets/icons/add.svg";
import clear_svg from "../assets/icons/clear.svg";
import fixed_svg from "../assets/icons/fixed.svg";
import view_svg from "../assets/icons/view.svg";
import setting_svg from "../assets/icons/setting.svg";

function icon(src: string) {
    return `<img src="${src}" class="icon">`;
}
function iconEl(src: string) {
    return el("img", { src, class: "icon", alt: "按钮图标" });
}

function uuid() {
    if (crypto.randomUUID) {
        return crypto.randomUUID().slice(0, 8);
    } else {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0,
                v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16).slice(0, 8);
        });
    }
}

function time() {
    return new Date().getTime();
}

if ("serviceWorker" in navigator) {
    if (import.meta.env.PROD) {
        navigator.serviceWorker.register("/sw.js");
    }
}

var setting = localforage.createInstance({
    name: "setting",
    driver: localforage.LOCALSTORAGE,
});

const CALENDARTYPE = "calendar.type";

const lan = navigator.language;

var events = localforage.createInstance({
    name: "event",
    storeName: "events",
});

var eventV = localforage.createInstance({
    name: "event",
    storeName: "v",
});

type Event = {
    start: Date;
    duration?: number;
    end: Date;
    name: string;
    note: string;
};

let todos: { event: Event; fixed?: boolean }[] = (await eventV.getItem("todos")) || [];

function writeTodos() {
    eventV.setItem("todos", todos);
}

let day2events: { [key: string]: string[] } = (await eventV.getItem("day2events")) || {};

function writeD2E() {
    eventV.setItem("day2events", day2events);
}

const submit: {
    title: string;
    url: string;
    user?: string;
    passwd?: string;
    uuid: string;
    lastSync: number;
    feq: number;
}[] = (await setting.getItem("calendar.calendars")) || [];
var subCalendar = localforage.createInstance({
    name: "calendar",
    storeName: "calendars",
});
var subCalendar2 = localforage.createInstance({
    name: "calendar",
    storeName: "day2events",
});

function getDateRangeStr(from: Date, to: Date) {
    const l: Date[] = [];
    let d = from;
    while (d.getTime() < to.getTime()) {
        l.push(d);
        d = new Date(d.getTime() + dayTime);
    }
    if (dateStr(l.at(-1)) != dateStr(to)) l.push(to);
    return l.map((d) => dateStr(d));
}

async function getEvent(id: string) {
    return (await events.getItem(id)) as Event;
}

async function setEvent(id: string, event: Event) {
    const oldE = await getEvent(id);
    if (oldE) getDateRangeStr(oldE.start, oldE.end).map((s) => (day2events[s] = day2events[s].filter((e) => e != id)));
    await events.setItem(id, event);
    getDateRangeStr(event.start, event.end).map((s) => {
        if (!day2events[s]) day2events[s] = [];
        if (!day2events[s].includes(id)) day2events[s].push(id);
        writeD2E();
    });
}

async function rmEvent(id: string) {
    const oldE = await getEvent(id);
    if (oldE) getDateRangeStr(oldE.start, oldE.end).map((s) => (day2events[s] = day2events[s].filter((e) => e != id)));
    await events.removeItem(id);
    writeD2E();
}

function icsParser(ics: string) {
    let l = ics.trim().split("\n");
    let root: { keys: string[]; value: string | typeof root }[] = [];
    let depthL: { keys: string[]; value: string | typeof root }[][] = [];

    let nl: string[] = [];
    for (let i of l) {
        if (i.startsWith(" ")) nl.with(-1, nl.at(-1) + i.trim());
        else nl.push(i);
    }

    function get(str: string) {
        let l = str.split(":");
        let keys = l[0].split(";");
        return { keys, value: l.slice(1).join(":") };
    }

    for (let i of nl) {
        if (i.startsWith("BEGIN:")) {
            depthL.push([]);
            depthL.at(-1).push(get(i));
        } else if (i.startsWith("END:")) {
            depthL.at(-2)?.push({ keys: [depthL.at(-1)[0].value as string], value: depthL.at(-1).slice(1) });
            if (depthL.length > 1) depthL.pop();
        } else {
            let l = depthL.at(-1);
            l.push(get(i));
        }
    }
    return depthL[0];
}

/************************************UI */
function dialogX(el: HTMLDialogElement) {
    document.body.append(el);
    el.showModal();
    el.addEventListener("close", () => {
        el.remove();
    });
}

const cal = el("div", { class: "cal" });
const timeLine = el("div", { class: "timeline" });

const dayEl = (date: Date) => {
    return el("div", { class: "day", style: { "view-transition-name": dateStr2(date) } }, [date.getDate()]);
};

function dateStr(date: Date) {
    if (!date) return "";
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date
        .getDate()
        .toString()
        .padStart(2, "0")}`;
}
function dateStr2(date: Date, mark?: string) {
    return `${mark || "a"}${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, "0")}${date
        .getDate()
        .toString()
        .padStart(2, "0")}`;
}
function weekdayStr(m: number, n: string) {
    return `w${m}${n}`;
}

// 当天0点
function dateZ(date: Date) {
    return new Date(dateStr(date).replaceAll("-", "/"));
}

const dayTime = 24 * 60 * 60 * 1000;

const dayEl2 = async (date: Date) => {
    const datestr = dateStr(date);
    const div = el("div", { "data-date": datestr, style: { "view-transition-name": dateStr2(date, "b") } });
    for (let i = 0; i < 24; i++) {
        div.append(el("div"));
    }
    const start = dateZ(date);
    const end = new Date(start.getTime() + dayTime);
    const eventsId = day2events?.[datestr] || [];
    for (let id of eventsId) {
        const e = await getEvent(id);
        if (!e) {
            day2events[datestr] = day2events[datestr].filter((i) => i !== id);
            writeD2E();
            continue;
        }
        let eStart = e.start;
        let eEnd = e.end;
        if (eStart.getTime() < start.getTime()) {
            eStart = start;
        }
        if (eEnd.getTime() > end.getTime()) {
            eEnd = end;
        }
        let top = (eStart.getTime() - start.getTime()) / dayTime;
        let height = (eEnd.getTime() - eStart.getTime()) / dayTime;
        div.append(
            el(
                "div",
                {
                    class: "event",
                    style: { height: `${height * 100}%`, top: top * 100 + "%" },
                    "data-id": id,
                    onclick: () => add(id),
                },
                [el("div", e.name)]
            )
        );
    }
    return div;
};

function timeRange(centerDate: Date, partLen: number) {
    const timeList: Date[] = [];
    const start = new Date(centerDate.getTime() - partLen * dayTime);
    for (let i = 0; i < partLen * 2 + 1; i++) {
        const date = new Date(start.getTime() + i * dayTime);
        timeList.push(date);
    }
    return timeList;
}

function daysView(centerDate: Date, partLen: number) {
    const timeList = timeRange(centerDate, partLen);
    const div = el("div", { class: "day_view" });
    for (let d of timeList) {
        div.append(
            el(
                "div",
                dayEl(d),

                el(
                    "span",
                    new Intl.DateTimeFormat(lan, {
                        weekday: "short",
                    }).format(d),
                    {
                        style: {
                            "view-transition-name": weekdayStr(
                                centerDate.getMonth(),
                                new Intl.DateTimeFormat(lan, {
                                    weekday: "narrow",
                                }).format(d)
                            ),
                        },
                    }
                ),
                {
                    onclick: () => {
                        selectDate = d;
                        setCalView("5");
                        setTimeLine(selectDate, timeWidth);
                    },
                }
            )
        );
    }
    return div;
}

function chineseDay(d: string) {
    d = d
        .replace("日", "")
        .padStart(2, "0")
        .replace(/(\w)(\w)/, (str, a, b) => {
            return (
                ["初", "十", "廿", "卅"][parseInt(a)] +
                ["十", "一", "二", "三", "四", "五", "六", "七", "八", "九"][parseInt(b)]
            );
        });
    let m = { 十十: "初十", 廿十: "二十", 卅十: "三十" };
    if (m[d]) d = m[d];
    return d;
}

function getOtherDay(date: Date, name: string) {
    let d = new Intl.DateTimeFormat(name, {
        day: "numeric",
    }).format(date);
    if (name === "zh-CN-u-ca-chinese") {
        d = chineseDay(d);
        if (d === "初一")
            d = new Intl.DateTimeFormat(name, {
                month: "short",
            }).format(date);
    }
    return d;
}

function monthView(year: number, month: number, isYear?: boolean) {
    const today = new Date();
    let dateList: Date[] = [];
    let nowDate = new Date(year, month, 1);
    const startDay = 0;
    while (nowDate.getDay() != startDay) {
        nowDate = new Date(nowDate.getTime() - dayTime);
        dateList.unshift(nowDate);
    }
    nowDate = new Date(year, month, 1);
    while (nowDate.getMonth() === month) {
        dateList.push(nowDate);
        nowDate = new Date(nowDate.getTime() + dayTime);
    }
    nowDate = new Date(year, month, dateList[dateList.length - 1].getDate());
    while (nowDate.getDay() != 6) {
        nowDate = new Date(nowDate.getTime() + dayTime);
        dateList.push(nowDate);
    }
    let pel = el("div", { class: "month_view" });
    let dayList: string[] = [];
    for (let i = 0; i < 7; i++) {
        const d = dateList[i];
        dayList.push(
            new Intl.DateTimeFormat(lan, {
                weekday: "narrow",
            }).format(d)
        );
    }
    for (let i of dayList) {
        let div = el("div", { "view-transition-name": weekdayStr(month, i) });
        if (selectDate.getMonth() === month) setStyle(div, { "view-transition-name": weekdayStr(month, i) });
        div.innerText = `${i}`;
        div.classList.add("calendar_week");
        pel.append(div);
    }
    for (let i of dateList) {
        let div = el("div", { class: "day" });
        div.onclick = () => {
            selectDate = i;
            cal.querySelector(".calendar_select").classList.remove("calendar_select");
            div.classList.add("calendar_select");
            if (!isYear) {
                // @ts-ignore
                document?.startViewTransition();
            } else {
                cal.querySelectorAll("day").forEach((el: HTMLElement) => {
                    setStyle(el, { "view-transition-name": "" });
                });
                pel.querySelectorAll("div").forEach((el) => {
                    setStyle(el, { "view-transition-name": el.getAttribute("view-transition-name") });
                });
            }
            setTimeLine(selectDate, timeWidth);
        };
        div.append(el("span", i.getDate()));
        if (!isYear) div.append(el("span", getOtherDay(i, "zh-CN-u-ca-chinese")));
        if (i.getMonth() === month) {
            div.setAttribute("view-transition-name", dateStr(i));
            if (selectDate.getMonth() === month) setStyle(div, { "view-transition-name": dateStr2(i) });
            div.classList.add("calendar_month");
        } else {
            div.innerText = "";
        }
        if (dateStr2(i) === dateStr2(today)) {
            div.classList.add("calendar_today");
        }
        if (dateStr(i) === dateStr(selectDate)) {
            cal.querySelector(".calendar_select")?.classList?.remove("calendar_select");
            div.classList.add("calendar_select");
        }
        pel.append(div);
    }
    return pel;
}

function yearView(date: Date) {
    const year = date.getFullYear();
    const div = el("el", { class: "year_view" });
    for (let m = 0; m < 12; m++) {
        const title = new Intl.DateTimeFormat(lan, {
            month: "long",
        }).format(new Date(`${year}-${m + 1}-1`));
        div.append(el("div", el("h2", title), monthView(year, m, true)));
    }
    return div;
}

const titleEl = el("div", { class: "title" });

let timeWidth = 2;

function setCalView(type: "5" | "month" | "year") {
    setting.setItem(CALENDARTYPE, type);
    // @ts-ignore
    if (!document.startViewTransition) {
        run();
        return;
    }
    // @ts-ignore
    document.startViewTransition(() => {
        run();
    });

    function run() {
        cal.innerHTML = "";
        let title = "";
        if (type === "5") {
            cal.append(daysView(selectDate, timeWidth));
            title = new Intl.DateTimeFormat(lan, {
                year: "numeric",
                month: "long",
            }).format(selectDate);
        }
        if (type === "month") {
            cal.append(monthView(selectDate.getFullYear(), selectDate.getMonth()));
            title = new Intl.DateTimeFormat(lan, {
                year: "numeric",
                month: "long",
            }).format(selectDate);
        }
        if (type === "year") {
            cal.append(yearView(selectDate));
            title = new Intl.DateTimeFormat(lan, {
                year: "numeric",
            }).format(selectDate);
        }
        titleEl.innerText = title;
    }
}

async function setTimeLine(centerDate: Date, partLen: number) {
    const timeList = timeRange(centerDate, partLen);
    const div = el("div", { class: "timeline_main" });
    const text = el("div", { class: "timeline_text" });
    for (let i = 0; i <= 24; i++) {
        text.append(el("div", el("span", i)));
    }
    for (let d of timeList) {
        div.append(await dayEl2(d));
    }

    timeLine.innerHTML = "";
    timeLine.append(text);
    timeLine.append(div);
}

function setPointer() {
    const now = new Date();
    let todayEl = timeLine.querySelector(`[data-date="${dateStr(now)}"]`);
    const deltaT = now.getTime() - dateZ(now).getTime();
    const top = deltaT / dayTime;
    if (todayEl) {
        let pointer = todayEl.querySelector(".pointer") as HTMLElement;
        if (!pointer) {
            pointer = el("div", { class: "pointer" });
            todayEl.append(pointer);
        }
        pointer.style.top = top * 100 + "%";
        if (dayTime - deltaT < 2000)
            setTimeout(() => {
                pointer?.remove();
            }, 2000);
    }
}

function time2str(date: Date) {
    if (!date) return "";
    return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}
function time2str2(num: number) {
    if (!num) return "";
    const date = new Date(num);
    return `${date.getUTCHours().toString().padStart(2, "0")}:${date.getUTCMinutes().toString().padStart(2, "0")}`;
}
function timeStr2num(time: string) {
    return new Date(`1970-01-01T${time}Z`).getTime();
}
function date2str(date: Date) {
    if (!date) return "";
    return `${dateStr(date)}T${time2str(date)}`;
}

function fixTime(e: Event) {
    if (!e.start || !e.end) return e;
    if (e.end.getTime() <= e.start.getTime()) {
        e.end = new Date(e.end.getTime() + 1000 * 60 * 5);
    }
    return e;
}

async function add(id: string) {
    const oldE = await getEvent(id);
    const title = oldE ? "更改" : "新增";
    const dialog = el("dialog", { class: "add" }) as HTMLDialogElement;
    const name = el("input", { placeholder: "日程标题", value: oldE?.name || "" });
    const startDate = el("input", {
        value: date2str(oldE?.start) || "",
        type: "datetime-local",
    });
    const d2 = time2str2(oldE?.end?.getTime() - oldE?.start?.getTime());
    const duration = el("input", {
        value: time2str2(oldE?.duration) || d2 || "",
        disabled: !Boolean(oldE?.duration),
        type: "time",
    });
    const durationLock = el("input", {
        checked: Boolean(oldE?.duration),
        type: "checkbox",
    });
    const endDate = el("input", {
        value: date2str(oldE?.end) || "",
        type: "datetime-local",
    });
    startDate.oninput = () => {
        if (duration.value && durationLock.checked) {
            endDate.value = date2str(new Date(new Date(startDate.value).getTime() + timeStr2num(duration.value)));
        }
        if (!durationLock.checked) {
            duration.value = time2str2(new Date(endDate.value).getTime() - new Date(startDate.value).getTime());
        }
    };
    endDate.oninput = () => {
        if (duration.value && durationLock.checked) {
            startDate.value = date2str(new Date(new Date(endDate.value).getTime() - timeStr2num(duration.value)));
        }
        if (!durationLock.checked) {
            duration.value = time2str2(new Date(endDate.value).getTime() - new Date(startDate.value).getTime());
        }
    };
    duration.oninput = () => {
        if (startDate.value) {
            endDate.value = date2str(new Date(new Date(startDate.value).getTime() + timeStr2num(duration.value)));
        }
    };
    durationLock.oninput = () => {
        duration.disabled = !durationLock.checked;
    };
    const note = el("textarea", { placeholder: "备注", value: oldE?.note || "" });
    const ok = el(
        "button",
        {
            onclick: async () => {
                dialog.close();
                let event: Event = {
                    name: name.value || "未命名事件",
                    start: startDate.value ? new Date(startDate.value) : null,
                    end: endDate.value ? new Date(endDate.value) : null,
                    note: note.value,
                };
                event = fixTime(event);
                if (duration && durationLock.checked) event.duration = timeStr2num(duration.value);
                if (!startDate.value) {
                    todos.push({ event });
                    writeTodos();
                    if (oldE) rmEl.click();
                } else {
                    if (!endDate.value) {
                        event.end = new Date(new Date(startDate.value).getTime() + 1000 * 60 * 5);
                    }
                    await setEvent(id, event);
                    setTimeLine(new Date(startDate.value), timeWidth);
                }
            },
        },
        iconEl(ok_svg)
    );
    const close = el(
        "button",
        {
            onclick: () => {
                dialog.close();
            },
        },
        iconEl(close_svg)
    );
    const rmEl = el(
        "button",
        {
            onclick: async () => {
                dialog.close();
                await rmEvent(id);
                setTimeLine(selectDate, timeWidth);
            },
        },
        iconEl(clear_svg)
    );
    dialog.append(
        el("h1", title),
        name,
        el("br"),
        el(
            "label",
            "开始时间",
            startDate,
            el("button", "现在", {
                onclick: () => {
                    startDate.value = date2str(new Date());
                    startDate.dispatchEvent(new Event("input"));
                },
            })
        ),
        el("br"),
        el("span", el("label", "持续时间", duration), el("label", "锁定", durationLock)),
        el("br"),
        el(
            "label",
            "结束时间",
            endDate,
            el("button", "现在", {
                onclick: () => {
                    endDate.value = date2str(new Date());
                    endDate.dispatchEvent(new Event("input"));
                },
            })
        ),
        el("br"),
        note,
        el("br"),
        close,
        ok
    );
    if (oldE) close.before(rmEl);
    dialogX(dialog);
}

function todo() {
    const dialog = el("dialog", { class: "todo_dialog" }) as HTMLDialogElement;
    const div = el("div");
    for (let i of todos.toReversed()) {
        const fixedEl = el("input", { type: "checkbox", checked: i.fixed });
        div.append(
            el("div", [
                el(
                    "span",
                    {
                        onclick: async () => {
                            dialog.close();
                            let event = structuredClone(i.event);
                            event.start = selectDate;
                            event.start.setHours(new Date().getHours());
                            event.start.setMinutes(new Date().getMinutes());
                            event.start.setSeconds(0);
                            event = fixTime(event);
                            if (!event.end) {
                                event.end = new Date(selectDate.getTime() + (event.duration || 1000 * 60 * 5));
                            }
                            await setEvent(uuid(), event);
                            setTimeLine(selectDate, timeWidth);
                            if (!i.fixed) {
                                todos = todos.filter((e) => e !== i);
                                writeTodos();
                            }
                        },
                        oncontextmenu: (e) => {
                            e.preventDefault();
                            fixedEl.checked = !fixedEl.checked;
                            i.fixed = fixedEl.checked;
                            writeTodos();
                        },
                    },
                    i.event.name
                ),
                el(
                    "span",
                    { class: "todo_spend" },
                    time2str2(i.event.duration ?? i.event.end?.getTime() - i.event.start?.getTime())
                ),
                el("label", fixedEl, iconEl(fixed_svg)),
            ])
        );
    }
    if (!todos.length) div.append(el("p", "没有代办"));
    dialog.append(el("h1", "代办"), div);
    dialog.append(
        el("button", iconEl(close_svg), {
            onclick: () => {
                dialog.close();
            },
        })
    );
    dialogX(dialog);
}

const l = el("div", { popover: "auto", class: "view_popover", onclick: () => l.hidePopover() }, [
    el("div", "5天视图", {
        onclick: () => {
            setCalView("5");
        },
    }),
    el("div", "月视图", {
        onclick: () => {
            setCalView("month");
        },
    }),
    el("div", "年视图", {
        onclick: () => {
            setCalView("year");
        },
    }),
]);

const settingEl = el("div", { popover: "auto" });

const subEl = el("div");

function subItem(i: (typeof submit)[0]) {
    return el("div", el("span", i.title));
}

function updateSub() {
    subEl.innerHTML = "";
    for (const i of submit) {
        subEl.append(subItem(i));
    }
    const uploadIcs = el("input", { type: "file" });
    subEl.append(el("div", el("label", uploadIcs, "上传")));
    uploadIcs.onchange = () => {
        const file = uploadIcs.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const text = reader.result?.toString();
            if (!text) return;
            const ics = icsParser(text);
            const id = uuid();
            const title = ics.find((i) => i.keys[0] === "X-WR-CALNAME").value as string;
            for (let i of ics) {
                if (typeof i.value !== "string") {
                    const start = i.value.find((i) => i.keys[0] === "DTSTART");
                    const end = i.value.find((i) => i.keys[0] === "DTEND");
                    // 计算日期

                    let map = { calId: id, id: i.value.find((i) => i.keys[0] === "UID") };
                }
            }
            subCalendar.setItem(id, ics);
            updateSub();
        };
    };
}
document.body.append(settingEl);
settingEl.append(subEl);

settingEl.append(
    el("div", [
        el("h2", "关于"),
        el("button", "更新", {
            onclick: async () => {
                const cacheKeepList = ["v2"];
                const keyList = await caches.keys();
                const cachesToDelete = keyList.filter((key) => !cacheKeepList.includes(key));
                await Promise.all(
                    cachesToDelete.map(async (key) => {
                        await caches.delete(key);
                    })
                );
            },
        }),
    ])
);

updateSub();

document.body.append(
    el(
        "div",
        { class: "top_bar" },
        titleEl,
        el("button", iconEl(view_svg), { onclick: () => l.showPopover() }),
        l,
        el("button", iconEl(setting_svg), {
            onclick: () => settingEl.showPopover(),
        })
    )
);

document.body.append(cal, timeLine);
document.body.append(
    el("div", { class: "button_bar" }, [
        el("button", { onclick: todo }, iconEl(todo_svg)),
        el("button", { onclick: () => add(uuid()) }, iconEl(add_svg)),
    ])
);

let selectDate = new Date();

setCalView((await setting.getItem(CALENDARTYPE)) || "month");
setTimeLine(selectDate, timeWidth);

setPointer();

setInterval(() => {
    setPointer();
}, 1000);
