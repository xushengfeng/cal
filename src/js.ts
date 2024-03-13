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
import fixed_svg from "../assets/icons/fixed.svg";

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
    return el("div", { class: "day" }, [date.getDate()]);
};

function dateStr(date: Date) {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

const dayTime = 24 * 60 * 60 * 1000;

const dayEl2 = async (date: Date) => {
    const div = el("div", { "data-date": dateStr(date) });
    for (let i = 0; i < 24; i++) {
        div.append(el("div"));
    }
    const start = new Date(dateStr(date));
    const end = new Date(start.getTime() + dayTime);
    const eventsId = day2events?.[dateStr(date)] || [];
    for (let id of eventsId) {
        const e = await getEvent(id);
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
    const div = el("div");
    for (let d of timeList) {
        div.append(dayEl(d));
    }
    return div;
}

function setCalView(type: "") {
    cal.innerHTML = "";
    cal.append(daysView(new Date(), 2));
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
    const deltaT = now.getTime() - new Date(dateStr(now)).getTime();
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

async function add(id: string) {
    const oldE = await getEvent(id);
    const title = oldE ? "更改" : "新增";
    const dialog = el("dialog") as HTMLDialogElement;
    const name = el("input", { value: oldE?.name || "" });
    const startDate = el("input", { value: oldE?.start || "" });
    const endDate = el("input", { value: oldE?.end || "" });
    const note = el("textarea", { value: oldE?.note || "" });
    const ok = el(
        "button",
        {
            onclick: async () => {
                dialog.close();
                let event: Event = {
                    name: name.value,
                    start: startDate.value ? new Date(startDate.value) : null,
                    end: endDate.value ? new Date(endDate.value) : null,
                    note: note.value,
                };
                if (!startDate.value) {
                    todos.push({ event });
                    writeTodos();
                } else {
                    if (!endDate.value) {
                        event.end = new Date(new Date(startDate.value).getTime() + 1000 * 60 * 5);
                    }
                    await setEvent(id, event);
                    setTimeLine(new Date(), 3);
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
    dialog.append(el("h1", title), name, startDate, endDate, note, close, ok);
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
                            const event = structuredClone(i.event);
                            event.start = new Date();
                            if (!event.end) {
                                event.end = new Date(new Date().getTime() + 1000 * 60 * 5);
                            }
                            await setEvent(uuid(), event);
                            setTimeLine(new Date(), 3);
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
                el("label", fixedEl, iconEl(fixed_svg)),
            ])
        );
    }
    if (!todos.length) div.append(el("p", "没有代办"));
    dialog.append(el("h1", "代办"), div);
    dialogX(dialog);
}

document.body.append(cal, timeLine);
document.body.append(
    el("div", { class: "button_bar" }, [
        el("button", { onclick: todo }, iconEl(todo_svg)),
        el("button", { onclick: () => add(uuid()) }, iconEl(add_svg)),
    ])
);

setCalView("");
setTimeLine(new Date(), 2);

setPointer();

setInterval(() => {
    setPointer();
}, 1000);
