
const conanSeason1 = {
  courseId: "conan-season-1",
  contentType: "story",
  level: "beginner",
  category: "anime",

  characters: [
    "Shinichi",
    "Conan",
    "Ran",
    "Kogoro",
    "Agasa",
    "Megure",
    "Ayumi",
    "Genta",
    "Mitsuhiko",
    "Sonoko",
    "Gin",
    "Vodka",
  ],

  // Reuse existing StudyJony voice profiles.
  voiceIds: {
    Shinichi: "s3TPKV1kjDlVtZbl4Ksh",
    Conan: "HJdgjMBpPzwZ2VRzSTbw",
    Ran: "ur0MtycxCulNrunXsdLx",
    Kogoro: "lYe6DCiOU0u0FedCMmZ0",
    Agasa: "oF10V53nXu6mNLtJLgko",
    Megure: "oflxQzyUUjpgLlEYlSq2",
    Ayumi: "LOM9LeWY0TSi7lJaGWjz",
    Genta: "HJdgjMBpPzwZ2VRzSTbw",
    Mitsuhiko: "s3TPKV1kjDlVtZbl4Ksh",
    Sonoko: "LOM9LeWY0TSi7lJaGWjz",
    Gin: "oflxQzyUUjpgLlEYlSq2",
    Vodka: "oF10V53nXu6mNLtJLgko",
  },

  dialogues: [
    // Chapter 1: A fun day becomes a mystery.
    // Speakers: Shinichi, Ran
    {
      dialogueId: "the-roller-coaster",
      title: "Tàu lượn bí ẩn",
      thumbnail:
        "/stories/conan-season-1/thumbnails/the-roller-coaster.png",
      situation:
        "Shinichi và Ran vui vẻ trò chuyện sau khi đi tàu lượn. Khi chuẩn bị về nhà, Shinichi nhìn thấy hai người đàn ông đáng ngờ.",
    },

    // Chapter 2: Shinichi disappears.
    // Speakers: Shinichi, Gin, Vodka
    {
      dialogueId: "the-men-in-black",
      title: "Hai người đàn ông mặc đồ đen",
      thumbnail:
        "/stories/conan-season-1/thumbnails/the-men-in-black.webp",
      situation:
        "Shinichi bí mật đi theo hai người đàn ông mặc đồ đen. Họ phát hiện ra cậu, tấn công và ép cậu uống một viên thuốc lạ.",
    },

    // Chapter 3: A shocking transformation.
    // Speakers: Conan, Agasa
    {
      dialogueId: "a-small-body",
      title: "Cơ thể nhỏ bé",
      thumbnail:
        "/stories/conan-season-1/thumbnails/a-small-body.webp",
      situation:
        "Shinichi tỉnh dậy trong cơ thể một đứa trẻ. Cậu tìm đến tiến sĩ Agasa và nhờ ông giữ bí mật về thân phận của mình.",
    },

    // Chapter 4: A new identity.
    // Speakers: Conan, Ran, Kogoro
    {
      dialogueId: "a-boy-named-conan",
      title: "Cậu bé tên Conan",
      thumbnail:
        "/stories/conan-season-1/thumbnails/a-boy-named-conan.webp",
      situation:
        "Ran gặp một cậu bé lạ ở nhà tiến sĩ Agasa. Shinichi tự giới thiệu mình là Conan và được Ran đưa về sống cùng gia đình.",
    },

    // Chapter 5: Conan notices his first clue.
    // Speakers: Conan, Ran, Kogoro
    {
      dialogueId: "the-locked-room",
      title: "Căn phòng khóa kín",
      thumbnail:
        "/stories/conan-season-1/thumbnails/the-locked-room.webp",
      situation:
        "Kogoro đến điều tra một vụ án trong căn phòng khóa kín. Conan quan sát hiện trường và phát hiện một chi tiết mà mọi người bỏ qua.",
    },

    // Chapter 6: New friends and an adventure.
    // Speakers: Conan, Ayumi, Mitsuhiko
    {
      dialogueId: "the-secret-map",
      title: "Tấm bản đồ bí mật",
      thumbnail:
        "/stories/conan-season-1/thumbnails/the-secret-map.webp",
      situation:
        "Conan cùng Ayumi và Mitsuhiko tìm thấy một tấm bản đồ kỳ lạ. Cả ba bàn bạc về những ký hiệu và quyết định đi tìm kho báu.",
    },

    // Chapter 7: Danger during a train ride.
    // Speakers: Conan, Ran, Kogoro
    {
      dialogueId: "danger-on-the-train",
      title: "Nguy hiểm trên tàu",
      thumbnail:
        "/stories/conan-season-1/thumbnails/danger-on-the-train.webp",
      situation:
        "Trên chuyến tàu cùng Ran và Kogoro, Conan nghe được chuyện về một chiếc túi nguy hiểm. Cậu cố tìm cách cảnh báo mọi người.",
    },

    // Chapter 8: A strange warning.
    // Speakers: Conan, Ran, Kogoro
    {
      dialogueId: "the-strange-gifts",
      title: "Những món quà kỳ lạ",
      thumbnail:
        "/stories/conan-season-1/thumbnails/the-strange-gifts.webp",
      situation:
        "Kogoro kể về một bác sĩ liên tục nhận những món quà bí ẩn. Conan đặt câu hỏi và nhận ra các món quà có thể là lời cảnh báo.",
    },

    // Chapter 9: A mystery in the museum.
    // Speakers: Conan, Ran, Kogoro
    {
      dialogueId: "mystery-at-the-museum",
      title: "Bí ẩn ở bảo tàng",
      thumbnail:
        "/stories/conan-season-1/thumbnails/mystery-at-the-museum.webp",
      situation:
        "Conan, Ran và Kogoro đến bảo tàng nghệ thuật. Khi một vụ án xảy ra, Conan phát hiện một manh mối kỳ lạ gần bộ áo giáp.",
    },

    // Chapter 10: A missing boy.
    // Speakers: Conan, Ran, Kogoro
    {
      dialogueId: "the-soccer-players-secret",
      title: "Bí mật của cầu thủ",
      thumbnail:
        "/stories/conan-season-1/thumbnails/the-soccer-players-secret.webp",
      situation:
        "Kogoro nhận được lời nhờ giúp tìm một cậu bé mất tích. Conan biết cậu bé là em trai của một cầu thủ nổi tiếng và phát hiện manh mối.",
    },
  ],
};

export default conanSeason1;
