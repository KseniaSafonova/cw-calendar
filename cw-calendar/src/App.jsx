import { useEffect, useState, useRef } from "react"
import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import { supabase } from "./supabaseClient"
import './App.css';
import listPlugin from "@fullcalendar/list";

export default function App() {
  const [dancer, setDancer] = useState(null)
  const [events, setEvents] = useState([])
  const [selectedDate, setSelectedDate] = useState(null);
  const [mySlots, setMySlots] = useState([]);
  const [allDayUnavailable, setAllDayUnavailable] = useState(false);

  const SLOTS = ["12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
    "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"]
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, []);

  const calendarRef = useRef(null);

  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;

    api.changeView(isMobile ? "dayGridDay" : "dayGridWeek");
  }, [isMobile]);

  async function openDay(date) {
    console.log("openDay start", date, dancer);

    if (!dancer) {
      console.log("Нет dancer");
      return;
    }


    const { data, error } = await supabase
      .from("availability")
      .select("start_time, all_day_unavailable")
      .eq("dancer_id", dancer.id)
      .eq("date", date);

    if (error) {
      console.error(error);
      return;
    }

    setSelectedDate({ date });

    setMySlots(
      data
        .filter(row => !row.all_day_unavailable)
        .map(row => row.start_time.slice(11, 16))
    );

    setAllDayUnavailable(
      data.some(row => row.all_day_unavailable)
    );
  }

  async function loadDancer(token) {
    const { data } = await supabase
      .from("dancers")
      .select("id, name")
      .eq("token", token)
      .single()

    setDancer(data || null)
  }

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");

    if (token) {
      loadDancer(token);
    }
  }, []);

  useEffect(() => {
    loadCalendar();
  }, []);

  async function loadCalendar() {
    const { data, error } = await supabase
      .from("availability")
      .select(`
      note_id,
      date,
      start_time,
      all_day_unavailable,
      dancers(name)
    `);

    if (error) {
      console.error(error);
      return;
    }

    const grouped = {};

    data.forEach((row) => {

      if (row.all_day_unavailable) {

        const key = `${row.date}-all-day-${row.note_id}`;

        grouped[key] = {
          id: row.note_id,
          start: row.date,
          title: `${row.dancers?.name || "unknown"} (не может совсем)`,
          allDay: true,
          color: "#d9534f",
          extendedProps: {
            note_id: row.note_id,
            all_day: true,
          },
        };

        return;
      }

      const key = `${row.date}-${row.start_time.slice(11, 16)}`;

      if (!grouped[key]) {
        grouped[key] = {
          start: `${row.date}T${row.start_time.slice(11, 16)}:00`,
          title: "",
          allDay: false,
          color: "#3788d8",
          extendedProps: {
            slot: true,
            date: row.date,
            time: row.start_time.slice(11, 16),
          },
        };
      }
      grouped[key].title += grouped[key].title
        ? `, ${row.dancers?.name || "unknown"}`
        : row.dancers?.name || "unknown";
    });

    setEvents(Object.values(grouped));
  }

  async function hasAllDayUnavailable(date) {
    const { data, error } = await supabase
      .from("availability")
      .select("note_id")
      .eq("dancer_id", dancer.id)
      .eq("date", date)
      .eq("all_day_unavailable", true);

    if (error) {
      console.error(error);
      return false;
    }

    return data.length > 0;
  }

  async function hasTimeSlots(date) {
    const { data, error } = await supabase
      .from("availability")
      .select("note_id")
      .eq("dancer_id", dancer.id)
      .eq("date", date)
      .eq("all_day_unavailable", false);

    if (error) {
      console.error(error);
      return false;
    }

    return data.length > 0;
  }

  async function toggleSlot(date, time) {
    if (!dancer) {
      alert("Нет пользователя");
      return;
    }

    const start_time = `${date}T${time}:00`;

    const { data, error } = await supabase
      .from("availability")
      .select("note_id, start_time")
      .eq("dancer_id", dancer.id)
      .eq("date", date)
      .eq("all_day_unavailable", false);

    if (error) {
      console.error(error);
      return;
    }

    const existing = data.find(row =>
      row.start_time.slice(11, 16) === time
    );

    if (existing) {
      await supabase
        .from("availability")
        .delete()
        .eq("note_id", existing.note_id);

      setMySlots(prev => prev.filter(t => t !== time));

      loadCalendar();
      return;

    }

    if (await hasAllDayUnavailable(date)) {
      alert("Вы уже отметили, что не можете присутствовать весь день.");
      return;
    }

    await supabase
      .from("availability")
      .insert({
        dancer_id: dancer.id,
        start_time: start_time,
        date,
        all_day_unavailable: false,
      });

    setMySlots(prev => [...prev, time]);

    loadCalendar();
  }

  async function toggleAllDay(date) {
    if (!dancer) {
      alert("Нет пользователя");
      return;
    }

    if (await hasTimeSlots(date)) {
      alert("Сначала нужно удалить выбранное время");
      return;
    }

    const { data, error } = await supabase
      .from("availability")
      .select("note_id")
      .eq("dancer_id", dancer.id)
      .eq("date", date)
      .eq("all_day_unavailable", true);

    if (error) {
      console.error(error);
      return;
    }

    if (data.length > 0) {
      await supabase
        .from("availability")
        .delete()
        .eq("note_id", data[0].note_id);
      setAllDayUnavailable(false);
    } else {
      await supabase
        .from("availability")
        .insert({
          dancer_id: dancer.id,
          date,
          start_time: null,
          all_day_unavailable: true,
        });
    }
    setAllDayUnavailable(true);
    setMySlots([]);
    loadCalendar();

  }

  return (
    <div style={{ padding: 20 }}>
      <h2>
        Расписание репетиций CW{" "}
        {dancer ? `(${dancer.name})` : "(кто здесь?)"}
      </h2>
      {selectedDate && (
        <div className="times">

          {SLOTS.map((time) => (
            <button
              key={time}
              className={`button ${mySlots.includes(time) ? "active" : ""}`}
              onClick={() => toggleSlot(selectedDate.date, time)}
            >
              {mySlots.includes(time) ? "✅ " : ""}
              {time}
            </button>
          ))}
          <button
            className={`button unavailable ${allDayUnavailable ? "active" : ""}`}
            onClick={() => toggleAllDay(selectedDate.date)}
          >
            {allDayUnavailable ? "✅ " : ""}
            ❌ Не могу совсем
          </button>

        </div>
      )}
      <FullCalendar
        ref={calendarRef}
        plugins={[
          dayGridPlugin,
          interactionPlugin,
          listPlugin
        ]}
        initialView={isMobile ? "dayGridDay" : "dayGridWeek"}
        firstDay={1}
        selectable={true}
        events={events}
        height={isMobile ? "auto" : 500}
        eventTimeFormat={{
          hour: "2-digit",
          minute: "2-digit",
          meridiem: false,
          hour12: false,
        }}
        timeZone="Europe/Moscow"
        dateClick={(info) => {
          console.log("click date", info.dateStr);
          openDay(info.dateStr);
        }}
        eventClick={(info) => {
          if (info.event.extendedProps?.all_day) {
            openDay(info.event.startStr);
            return;
          }

          openDay(info.event.extendedProps.date);
        }} />
    </div>
  );
}