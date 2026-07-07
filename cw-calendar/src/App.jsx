import { useEffect, useState } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import { supabase } from "./supabaseClient"
import './App.css';

export default function App() {
  const [dancer, setDancer] = useState(null)
  const [events, setEvents] = useState([])
  const [selectedDate, setSelectedDate] = useState(null);

  const SLOTS = {
    week: ["19:00", "19:30", "20:00"],
    weekend: [
      "12:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
      "18:00",
      "19:00",
      "20:00"
    ]
  };

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");

    if (token) {
      loadDancer(token);
    }

    loadCalendar();
  }, []);

  async function loadDancer(token) {
    const { data } = await supabase
      .from("dancers")
      .select("id, name")
      .eq("token", token)
      .single()

    setDancer(data || null)
  }

  async function loadCalendar() {
    const { data, error } = await supabase
      .from("availability")
      .select(`
      note_id,
      start_time,
      dancer_id,
      dancers (
        name
      )
    `)

    if (error) {
      console.error(error);
      return
    }

    const grouped = {}

    data.forEach((row) => {
      const time = row.start_time
      const name = row.dancers?.name || "unknown"

      if (!grouped[time]) {
        grouped[time] = []
      }

      grouped[time].push(name)
    })

    const events = Object.entries(grouped).map(([time, list]) => ({
      start: time,
      title: list.join(", ") + ';'
    }))
    setEvents(events)
  }

  async function toggleSlot(start_time) {
    if (!dancer) {
      alert("Нет пользователя")
      return
    }

    const { data, error } = await supabase
      .from("availability")
      .select(`note_id`)
      .eq("dancer_id", dancer.id)
      .eq("start_time", start_time);

    if (error) {
      console.error(error);
      return;
    }

    if (data.length > 0) {
      await supabase
        .from("availability")
        .delete()
        .eq("note_id", data[0].note_id)
    } else {
      await supabase
        .from("availability")
        .insert({
          dancer_id: dancer.id,
          start_time
        })
    }

    loadCalendar()
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>
        Расписание репетиций CW{" "}
        {dancer ? `(${dancer.name})` : "(неопознанный объект)"}
      </h2>
      {selectedDate && (
        <div className={'times'}>
          {(selectedDate.isWeekend
            ? SLOTS.weekend
            : SLOTS.week
          ).map((time) => (
            <button
              className="button"
              key={time}
              onClick={() =>
                toggleSlot(`${selectedDate.date}T${time}:00`)
              }>
              {time}
            </button>
          ))}
        </div>
      )}

      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridWeek"
        firstDay={1}
        selectable={true}
        events={events}
        height={500}
        eventTimeFormat={{
          hour: "2-digit",
          minute: "2-digit",
          meridiem: false,
          hour12: false,
        }}
        timeZone="Europe/Moscow"
        dateClick={(info) => {
          setSelectedDate({
            date: info.dateStr,
            isWeekend: [0, 6].includes(info.date.getDay()),
          });
        }}
        eventClick={(info) => toggleSlot(info.event.startStr)} />
    </div>
  );
}