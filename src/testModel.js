(async () => {
  const { TextServiceClient } = await import("@google/generative-ai");

  const client = new TextServiceClient({
    apiKey: "AIzaSyCHKmX1Ujj_AntDGqWmi1RkQ8WxKbTV2yE"
  });

  try {
    const response = await client.listModels();
    console.log("Available models:");
    response.models.forEach(m => console.log(m.name));
  } catch (err) {
    console.error(err);
  }
})();
