// This controller is reachable only through Electron IPC, never through HTTP/WebSocket.
export function createHostController(server) {
  let queue = Promise.resolve();
  async function run(command, args = {}) {
    if (!args || typeof args !== "object" || Array.isArray(args))
      throw Error("Некорректные параметры");
    let status;
    switch (command) {
      case "status":
        status = server.getStatus();
        break;
      case "create":
        status = await server.createMatch({ bots: args.bots, level: args.level, mode: args.mode, mapId: args.mapId });
        break;
      case "lan-open":
        status = await server.openLan(args.port);
        break;
      case "lan-close":
        status = await server.closeLan();
        break;
      case "bot-add":
        status = server.manageBots("add", args.team);
        break;
      case "bot-remove":
        status = server.manageBots("remove", null, args.id);
        break;
      case "bot-clear":
        status = server.manageBots("clear");
        break;
      case "restart":
        status = server.restartMatch();
        break;
      case "stop":
        status = await server.createMatch();
        break;
      default:
        throw Error("Команда не разрешена");
    }
    return { ...status, endpoint: `ws://127.0.0.1:${server.port}` };
  }
  return {
    invoke(command, args) {
      const task = queue.then(() => run(command, args));
      queue = task.catch(() => {});
      return task.then(
        (result) => ({ ok: true, result }),
        (error) => ({ ok: false, error: error.message }),
      );
    },
  };
}
