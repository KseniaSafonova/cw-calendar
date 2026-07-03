import { useEffect, useState } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import { supabase } from "./supabaseClient"

export default function App() {
  const [dancer, setDancer] = useState(null)
  const [events, setEvents] = useState([])

  // =========================
  // 1. загрузка dancer по token
  // =========================
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token")
    if (token) loadDancer(token)
  }, [])

  async function loadDancer(token) {
    const { data } = await supabase
      .from("dancers")
      .select("*")
      .eq("token", token)
      .single()

    setDancer(data || null)
  }

  // =========================
  // 2. загрузка календаря
  // =========================
  useEffect(() => {
    loadCalendar()
  }, [])

  async function loadCalendar() {
    const { data, error } = await supabase
      .from("availability")
      .select("id, start_time, dancer_id")

    if (error) {
      console.log(error)
      return
    }

    const grouped = {}

    data.forEach((row) => {
      const time = row.start_time

      if (!grouped[time]) {
        grouped[time] = []
      }

      grouped[time].push(row.dancers.name)
    })

    const events = Object.entries(grouped).map(([time, list]) => ({
      start: time,
      title: names.join(", ")
    }))

    setEvents(events)
  }

  // =========================
  // 3. запись / отмена
  // =========================
  async function toggleSlot(start_time) {
    if (!dancer) {
      alert("Нет пользователя")
      return
    }

    const { data, error } = await supabase
      .from("availability")
      .select(`
    id,
    start_time,
    dancer_id,
    dancers (
      name
    )
  `)
      .eq("dancer_id", dancer.id)
      .eq("start_time", start_time)

    if (data.length > 0) {
      await supabase
        .from("availability")
        .delete()
        .eq("id", data[0].id)
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
        dateClick={(info) => {
          toggleSlot(info.dateStr);
        }}
        eventClick={(info) => toggleSlot(info.event.startStr)}
      />
    </div>
  )
}