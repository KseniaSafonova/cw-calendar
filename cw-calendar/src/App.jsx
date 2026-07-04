import { useEffect, useState } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import { supabase } from "./supabaseClient"
import localeRu from "@fullcalendar/core/locales/ru";

export default function App() {
  const [dancer, setDancer] = useState(null)
  const [events, setEvents] = useState([])
  const [selectedDate, setSelectedDate] = useState(null);

  const slots = [
    "18:00",
    "18:30",
    "19:00",
    "19:30",
    "20:00"
  ];

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token")
    if (token) loadDancer(token)
  }, [])

  async function loadDancer(token) {
    const { data } = await supabase
      .from("dancers")
      .select("id, name")
      .eq("token", token)
      .single()

    setDancer(data || null)
  }

  useEffect(() => {
    loadCalendar()
  }, [])

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
      console.log(error)
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
      title: list.join(", ")
    }))
    console.log(data);
    setEvents(events)
  }


  async function toggleSlot(start_time) {
    if (!dancer) {
      alert("Нет пользователя")
      return
    }

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

      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={events}
        eventTimeFormat={{
          hour: '2-digit',
          minute: '2-digit',
          meridiem: false,
          hour12: false
        }}
        timeZone='Europe/Moscow'
        dateClick={(info) => {
          toggleSlot(info.dateStr),
            setSelectedDate(info.dateStr)
        }}
        eventClick={(info) => toggleSlot(info.event.startStr)}
      />
      {selectedDate && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 100px)",
            gap: 10,
            marginTop: 20
          }}
        >
          {slots.map((time) => (
            <button
              key={time}
              onClick={() => toggleSlot(`${selectedDate}T${time}:00`)}
            >
              {time}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}