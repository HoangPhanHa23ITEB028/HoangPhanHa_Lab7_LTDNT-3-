
import { useEffect, useState } from "react";

import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  getDocs,
  doc,
  writeBatch,
} from "firebase/firestore";

import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { db } from "./src/firebase";

// =========================
// TYPES
// =========================

type Room = {
  id: string;
  name: string;
  building: string;
  floor: number;
  capacity: number;
  available: boolean;
};

type Booking = {
  id: string;
  roomId: string;
  roomName: string;
  building: string;
  slot: string;
  purpose: string;
  bookedBy: string;
  createdAt?: unknown;
};

type RoomCardProps = {
  room: Room;
  onSelect: (room: Room) => void;
  isSelected: boolean;
};

// =========================
// TIME SLOTS
// =========================

const slots = [
  "08:00-09:00",
  "09:00-10:00",
  "14:00-15:00",
];

const buildings = ["ALL", "Block A", "Block B"];

// =========================
// FAKE ROOM DATA
// =========================

const initialRooms: Omit<Room, "id">[] = [
  {
    name: "A101",
    building: "Block A",
    floor: 1,
    capacity: 40,
    available: true,
  },
  {
    name: "A102",
    building: "Block A",
    floor: 1,
    capacity: 30,
    available: false,
  },
  {
    name: "A201",
    building: "Block A",
    floor: 2,
    capacity: 50,
    available: true,
  },
  {
    name: "A202",
    building: "Block A",
    floor: 2,
    capacity: 35,
    available: true,
  },
  {
    name: "B101",
    building: "Block B",
    floor: 1,
    capacity: 45,
    available: true,
  },
  {
    name: "B102",
    building: "Block B",
    floor: 1,
    capacity: 25,
    available: false,
  },
  {
    name: "B201",
    building: "Block B",
    floor: 2,
    capacity: 60,
    available: true,
  },
  {
    name: "B202",
    building: "Block B",
    floor: 2,
    capacity: 40,
    available: true,
  },
];

// =========================
// SEED ROOMS IF EMPTY
// =========================

async function seedRoomsIfEmpty() {
  const roomsRef = collection(db, "rooms");

  // Read existing rooms from Firestore.
  const snapshot = await getDocs(roomsRef);

  // If rooms already exist, do not create sample data.
  if (!snapshot.empty) {
    console.log(
      `Rooms already exist: ${snapshot.size}. Skip seeding.`,
    );
    return;
  }

  // Create all sample rooms in one batch.
  const batch = writeBatch(db);

  initialRooms.forEach((room) => {
    const roomRef = doc(
      db,
      "rooms",
      room.name,
    );

    batch.set(roomRef, room);
  });

  await batch.commit();

  console.log(
    `Successfully created ${initialRooms.length} sample rooms.`,
  );
}

// =========================
// ROOM CARD
// =========================

function RoomCard({
  room,
  onSelect,
  isSelected,
}: RoomCardProps) {
  return (
    <View
      style={[
        styles.card,
        room.available
          ? styles.availableCard
          : styles.unavailableCard,
        isSelected && styles.selectedCard,
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.roomInfo}>
          <Text style={styles.roomName}>
            {room.name}
          </Text>

          <Text style={styles.roomBuilding}>
            Building: {room.building}
          </Text>

          <Text style={styles.roomMeta}>
            Floor: {room.floor}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            room.available
              ? styles.availableBadge
              : styles.unavailableBadge,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              room.available
                ? styles.availableStatusText
                : styles.unavailableStatusText,
            ]}
          >
            {room.available
              ? "Available"
              : "Unavailable"}
          </Text>
        </View>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>
          Capacity
        </Text>

        <Text style={styles.infoValue}>
          {room.capacity} people
        </Text>
      </View>

      <Pressable
        disabled={!room.available}
        style={[
          styles.selectButton,
          room.available
            ? styles.availableButton
            : styles.disabledButton,
          isSelected && styles.selectedButton,
        ]}
        onPress={() => onSelect(room)}
      >
        <Text style={styles.selectButtonText}>
          {!room.available
            ? "Not available"
            : isSelected
              ? "✓ Selected"
              : "Select Room"}
        </Text>
      </Pressable>
    </View>
  );
}

// =========================
// MAIN APP
// =========================

export default function App() {
  // Rooms from Firestore
  const [rooms, setRooms] = useState<Room[]>([]);

  // Bookings from Firestore
  const [bookings, setBookings] = useState<Booking[]>([]);

  // Selected room
  const [selectedRoom, setSelectedRoom] =
    useState<Room | null>(null);

  // Selected time slot
  const [selectedSlot, setSelectedSlot] =
    useState<string | null>(null);

  // Booking purpose
  const [purpose, setPurpose] = useState("");

  // Person who books the room
  const [bookedBy, setBookedBy] = useState("");

  // Message
  const [message, setMessage] = useState("");

  // Available-only filter
  const [availableOnly, setAvailableOnly] =
    useState(false);

  // Building filter
  const [selectedBuilding, setSelectedBuilding] =
    useState("ALL");

  // Loading and error states
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingBookings, setLoadingBookings] =
    useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [bookingError, setBookingError] = useState("");

  // Prevent duplicate booking submissions
  const [submitting, setSubmitting] = useState(false);

  // =========================
  // INITIALIZE SAMPLE ROOMS
  // =========================

  useEffect(() => {
    seedRoomsIfEmpty().catch((error) => {
      console.error(
        "Initialize sample rooms failed:",
        error,
      );
    });
  }, []);

  // =========================
  // LISTEN TO ROOMS REALTIME
  // =========================

  useEffect(() => {
    const roomsRef = collection(db, "rooms");

    const unsubscribe = onSnapshot(
      roomsRef,
      (snapshot) => {
        const roomItems: Room[] = snapshot.docs.map(
          (roomDoc) => {
            const data = roomDoc.data();

            return {
              id: roomDoc.id,
              name: data.name,
              building: data.building,
              floor: data.floor,
              capacity: data.capacity,
              available: data.available,
            };
          },
        );

        setRooms(roomItems);
        setLoadingRooms(false);
        setErrorMessage("");

        // Update selected room when Firestore changes.
        setSelectedRoom((currentRoom) => {
          if (!currentRoom) {
            return null;
          }

          const updatedRoom = roomItems.find(
            (room) => room.id === currentRoom.id,
          );

          // Clear selection if the room no longer exists
          // or becomes unavailable.
          if (
            !updatedRoom ||
            !updatedRoom.available
          ) {
            return null;
          }

          return updatedRoom;
        });
      },
      (error) => {
        console.error(
          "Listen rooms failed:",
          error,
        );

        setErrorMessage(
          "Cannot load rooms. Please try again.",
        );
        setLoadingRooms(false);
      },
    );

    return unsubscribe;
  }, []);

  // =========================
  // LISTEN TO BOOKINGS REALTIME
  // =========================

  useEffect(() => {
    const bookingsQuery = query(
      collection(db, "bookings"),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      bookingsQuery,
      (snapshot) => {
        const bookingItems: Booking[] =
          snapshot.docs.map((bookingDoc) => {
            const data = bookingDoc.data();

            return {
              id: bookingDoc.id,
              roomId: data.roomId,
              roomName: data.roomName,
              building: data.building,
              slot: data.slot,
              purpose: data.purpose,
              bookedBy: data.bookedBy ?? "Unknown",
              createdAt: data.createdAt,
            };
          });

        setBookings(bookingItems);
        setLoadingBookings(false);
        setBookingError("");
      },
      (error) => {
        console.error(
          "Listen bookings failed:",
          error,
        );

        setBookingError(
          "Cannot load recent bookings. Check Firestore settings.",
        );

        setLoadingBookings(false);
      },
    );

    return unsubscribe;
  }, []);

  // =========================
  // COUNTERS / FILTERS
  // =========================

  const availableRoomCount = rooms.filter(
    (room) => room.available,
  ).length;

  const visibleRooms = rooms.filter((room) => {
    const matchesBuilding =
      selectedBuilding === "ALL" ||
      room.building === selectedBuilding;

    const matchesAvailability =
      !availableOnly || room.available;

    return (
      matchesBuilding && matchesAvailability
    );
  });

  // =========================
  // SELECT ROOM
  // =========================

  function handleSelectRoom(room: Room) {
    if (!room.available) {
      return;
    }

    setSelectedRoom(room);
    setMessage("");
  }

  // =========================
  // SELECT TIME SLOT
  // =========================

  function handleSelectSlot(slot: string) {
    setSelectedSlot(slot);
    setMessage("");
  }

  // =========================
  // CLEAR SELECTION
  // =========================

  function handleClearSelection() {
    setSelectedRoom(null);
    setSelectedSlot(null);
    setMessage("");
  }

  // =========================
  // CREATE BOOKING
  // =========================

  async function handleBookRoom() {
    if (submitting) {
      return;
    }

    setMessage("");

    if (!selectedRoom) {
      setMessage("Please select a room.");
      return;
    }

    if (!selectedSlot) {
      setMessage("Please select a time slot.");
      return;
    }

    if (!purpose.trim()) {
      setMessage("Please enter purpose.");
      return;
    }

    if (!bookedBy.trim()) {
      setMessage("Please enter your name.");
      return;
    }

    if (!selectedRoom.available) {
      setMessage(
        "This room is no longer available.",
      );
      return;
    }

    try {
      setSubmitting(true);

      await addDoc(collection(db, "bookings"), {
        roomId: selectedRoom.id,
        roomName: selectedRoom.name,
        building: selectedRoom.building,
        slot: selectedSlot,
        purpose: purpose.trim(),
        bookedBy: bookedBy.trim(),
        createdAt: serverTimestamp(),
      });

      setMessage(
        "Booking created successfully!",
      );

      setPurpose("");
      setBookedBy("");
    } catch (error) {
      console.error(
        "Create booking failed:",
        error,
      );

      setMessage(
        "Cannot create booking. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // =========================
  // UI
  // =========================

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>
        WEEK 7 · REACT NATIVE + FIREBASE
      </Text>

      <Text style={styles.title}>
        Room Booking
      </Text>

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={
          styles.mainScrollContent
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ROOM LIST */}

        <Text style={styles.sectionTitle}>
          Available Rooms
        </Text>

        {/* AVAILABLE ROOMS COUNTER */}

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {availableRoomCount}
            </Text>

            <Text style={styles.statLabel}>
              Available Rooms
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {rooms.length}
            </Text>

            <Text style={styles.statLabel}>
              Total Rooms
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {bookings.length}
            </Text>

            <Text style={styles.statLabel}>
              Total Bookings
            </Text>
          </View>
        </View>

        {/* BUILDING FILTER */}

        <Text style={styles.label}>
          Filter by Building
        </Text>

        <View style={styles.filterRow}>
          {buildings.map((building) => {
            const isActive =
              selectedBuilding === building;

            return (
              <Pressable
                key={building}
                style={[
                  styles.filterButton,
                  isActive &&
                    styles.filterButtonActive,
                ]}
                onPress={() =>
                  setSelectedBuilding(building)
                }
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    isActive &&
                      styles.filterButtonTextActive,
                  ]}
                >
                  {building}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* AVAILABLE ONLY FILTER */}

        <Pressable
          style={[
            styles.availableOnlyButton,
            availableOnly &&
              styles.filterButtonActive,
          ]}
          onPress={() =>
            setAvailableOnly(!availableOnly)
          }
        >
          <Text
            style={[
              styles.filterButtonText,
              availableOnly &&
                styles.filterButtonTextActive,
            ]}
          >
            {availableOnly
              ? "✓ Showing Available Only"
              : "Show Available Only"}
          </Text>
        </Pressable>

        <Text style={styles.counterText}>
          Showing {visibleRooms.length} /{" "}
          {rooms.length} rooms
        </Text>

        {loadingRooms ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator
              size="large"
              color="#2563EB"
            />

            <Text style={styles.loadingText}>
              Loading rooms...
            </Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {errorMessage}
            </Text>
          </View>
        ) : (
          <FlatList
            style={styles.roomList}
            contentContainerStyle={
              styles.listContent
            }
            data={visibleRooms}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                No rooms match the selected filters.
              </Text>
            }
            renderItem={({ item }) => (
              <RoomCard
                room={item}
                onSelect={handleSelectRoom}
                isSelected={
                  selectedRoom?.id === item.id
                }
              />
            )}
          />
        )}

        {/* BOOKING FORM */}

        <View style={styles.bookingPanel}>
          <Text style={styles.bookingTitle}>
            Booking Information
          </Text>

          {/* SELECTED ROOM */}

          <View style={styles.selectedBox}>
            <Text style={styles.selectedLabel}>
              Selected Room
            </Text>

            <Text style={styles.selectedText}>
              {selectedRoom
                ? `${selectedRoom.name} · ${selectedRoom.building}`
                : "None"}
            </Text>

            {selectedRoom ? (
              <Text style={styles.roomMeta}>
                Floor: {selectedRoom.floor} · Capacity:{" "}
                {selectedRoom.capacity}
              </Text>
            ) : null}
          </View>

          {selectedRoom ? (
            <Pressable
              style={styles.clearButton}
              onPress={handleClearSelection}
            >
              <Text style={styles.clearButtonText}>
                Clear Selection
              </Text>
            </Pressable>
          ) : null}

          {/* TIME SLOT */}

          <Text style={styles.label}>
            Time Slot
          </Text>

          <View style={styles.slotRow}>
            {slots.map((slot) => {
              const isSelected =
                selectedSlot === slot;

              return (
                <Pressable
                  key={slot}
                  style={[
                    styles.slotButton,
                    isSelected &&
                      styles.selectedSlotButton,
                  ]}
                  onPress={() =>
                    handleSelectSlot(slot)
                  }
                >
                  <Text
                    style={[
                      styles.slotButtonText,
                      isSelected &&
                        styles.selectedSlotButtonText,
                    ]}
                  >
                    {slot}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* PURPOSE */}

          <Text style={styles.label}>
            Purpose
          </Text>

          <TextInput
            style={styles.input}
            value={purpose}
            onChangeText={setPurpose}
            placeholder="Enter booking purpose..."
            placeholderTextColor="#999"
            returnKeyType="done"
            editable={!submitting}
          />

          {/* BOOKED BY */}

          <Text style={styles.label}>
            Booked By
          </Text>

          <TextInput
            style={styles.input}
            value={bookedBy}
            onChangeText={setBookedBy}
            placeholder="Your name"
            placeholderTextColor="#999"
            returnKeyType="done"
            editable={!submitting}
          />

          {/* BOOK BUTTON */}

          <Pressable
            disabled={submitting}
            style={[
              styles.bookButton,
              submitting &&
                styles.bookButtonDisabled,
            ]}
            onPress={handleBookRoom}
          >
            <Text style={styles.bookButtonText}>
              {submitting
                ? "Booking..."
                : "Book Room"}
            </Text>
          </Pressable>

          {/* RESULT MESSAGE */}

          {message ? (
            <View style={styles.messageBox}>
              <Text style={styles.message}>
                {message}
              </Text>
            </View>
          ) : null}
        </View>

        {/* RECENT BOOKINGS */}

        <View style={styles.recentPanel}>
          <View style={styles.recentHeader}>
            <Text style={styles.bookingTitle}>
              Recent Bookings
            </Text>

            <Text style={styles.bookingCount}>
              {bookings.length}
            </Text>
          </View>

          <Text style={styles.totalBookingsText}>
            Total Bookings: {bookings.length}
          </Text>

          {loadingBookings ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator
                size="small"
                color="#2563EB"
              />

              <Text style={styles.loadingText}>
                Loading bookings...
              </Text>
            </View>
          ) : bookingError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                {bookingError}
              </Text>
            </View>
          ) : bookings.length === 0 ? (
            <Text style={styles.emptyText}>
              No bookings yet.
            </Text>
          ) : (
            bookings.slice(0, 3).map((booking) => (
              <View
                key={booking.id}
                style={styles.bookingCard}
              >
                <View
                  style={styles.bookingCardHeader}
                >
                  <Text style={styles.bookingRoomName}>
                    {booking.roomName}
                  </Text>

                  <Text style={styles.bookingSlot}>
                    {booking.slot}
                  </Text>
                </View>

                <Text style={styles.bookingBuilding}>
                  Building: {booking.building}
                </Text>

                <Text style={styles.bookingPurpose}>
                  Purpose: {booking.purpose}
                </Text>

                <Text style={styles.roomMeta}>
                  Booked by: {booking.bookedBy}
                </Text>
              </View>
            ))
          )}
        </View>

        <Text style={styles.footer}>
          Week 7 · Shared Data & Real-Time Updates
        </Text>
      </ScrollView>
    </View>
  );
}

// =========================
// STYLES
// =========================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 48,
    paddingHorizontal: 20,
    backgroundColor: "#F4F7FB",
  },

  mainScroll: {
    flex: 1,
  },

  mainScrollContent: {
    paddingBottom: 24,
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#64748B",
    marginBottom: 5,
  },

  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 20,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 12,
  },

  // STATS

  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },

  statCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 5,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  statNumber: {
    fontSize: 23,
    fontWeight: "800",
    color: "#2563EB",
  },

  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
    textAlign: "center",
    marginTop: 5,
  },

  // FILTERS

  label: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 7,
  },

  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },

  filterButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },

  filterButtonActive: {
    backgroundColor: "#16A34A",
    borderColor: "#16A34A",
  },

  filterButtonText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },

  filterButtonTextActive: {
    color: "#FFFFFF",
  },

  availableOnlyButton: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    marginBottom: 8,
  },

  counterText: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 12,
  },

  // LOADING / EMPTY / ERRORS

  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 22,
  },

  loadingText: {
    marginTop: 10,
    color: "#64748B",
    fontSize: 14,
  },

  emptyText: {
    color: "#64748B",
    fontSize: 14,
    paddingVertical: 12,
  },

  errorBox: {
    padding: 12,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
    marginBottom: 12,
  },

  errorText: {
    fontSize: 13,
    color: "#DC2626",
    lineHeight: 19,
  },

  // ROOM CARD

  roomList: {
    width: "100%",
  },

  listContent: {
    paddingBottom: 4,
  },

  card: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1.5,
  },

  availableCard: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
  },

  unavailableCard: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },

  selectedCard: {
    borderWidth: 2.5,
    borderColor: "#16A34A",
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },

  roomInfo: {
    flex: 1,
    marginRight: 8,
  },

  roomName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
  },

  roomBuilding: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 3,
  },

  roomMeta: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 5,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },

  availableBadge: {
    backgroundColor: "#DCFCE7",
  },

  unavailableBadge: {
    backgroundColor: "#FEE2E2",
  },

  statusText: {
    fontSize: 12,
    fontWeight: "800",
  },

  availableStatusText: {
    color: "#15803D",
  },

  unavailableStatusText: {
    color: "#DC2626",
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },

  infoLabel: {
    fontSize: 14,
    color: "#64748B",
  },

  infoValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
  },

  selectButton: {
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: "center",
  },

  availableButton: {
    backgroundColor: "#16A34A",
  },

  selectedButton: {
    backgroundColor: "#15803D",
  },

  disabledButton: {
    backgroundColor: "#EF4444",
  },

  selectButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },

  // BOOKING FORM

  bookingPanel: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 18,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  bookingTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 12,
  },

  selectedBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },

  selectedLabel: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 3,
  },

  selectedText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },

  clearButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    marginBottom: 12,
  },

  clearButtonText: {
    fontWeight: "700",
    color: "#475569",
  },

  slotRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },

  slotButton: {
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
  },

  selectedSlotButton: {
    backgroundColor: "#DBEAFE",
    borderColor: "#2563EB",
  },

  slotButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },

  selectedSlotButtonText: {
    color: "#1D4ED8",
  },

  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginBottom: 12,
    fontSize: 15,
    color: "#0F172A",
  },

  bookButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#2563EB",
  },

  bookButtonDisabled: {
    opacity: 0.6,
  },

  bookButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },

  messageBox: {
    marginTop: 12,
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },

  message: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 21,
    color: "#1E40AF",
  },

  // RECENT BOOKINGS

  recentPanel: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  bookingCount: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2563EB",
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },

  totalBookingsText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 12,
  },

  bookingCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    marginBottom: 8,
  },

  bookingCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },

  bookingRoomName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },

  bookingSlot: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1D4ED8",
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },

  bookingBuilding: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 5,
  },

  bookingPurpose: {
    fontSize: 13,
    color: "#334155",
    marginTop: 5,
  },

  footer: {
    textAlign: "center",
    fontSize: 12,
    color: "#94A3B8",
    paddingVertical: 12,
  },
});
