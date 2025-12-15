import { useQuery } from "@tanstack/react-query";
import { schedulesApi, teamsApi } from "../lib/api";

interface OnCallEntry {
  user_id: string;
  slot: {
    start: number;
    end: number;
  };
}

interface Team {
  team_id: string;
  name: string;
}

export default function SchedulePage() {
  const { data: teamsData } = useQuery({
    queryKey: ["teams"],
    queryFn: () => teamsApi.list(),
  });

  const { data: currentData, isLoading } = useQuery({
    queryKey: ["schedules", "current"],
    queryFn: () => schedulesApi.current(),
  });

  const teams: Team[] = teamsData?.teams || [];
  const onCall: Record<string, OnCallEntry | null> = currentData?.on_call || {};

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">On-Call Schedule</h1>

      {isLoading && (
        <div className="text-center text-gray-500 py-4">Loading...</div>
      )}

      {/* Current on-call by team */}
      <div className="space-y-4">
        {teams.map((team) => {
          const entry = onCall[team.team_id];
          return (
            <div key={team.team_id} className="bg-white rounded-lg shadow p-4">
              <h3 className="font-medium text-gray-900">{team.name}</h3>
              {entry ? (
                <div className="mt-2">
                  <p className="text-green-600 font-medium">
                    🟢 {entry.user_id}
                  </p>
                  <p className="text-sm text-gray-500">
                    Until {new Date(entry.slot.end).toLocaleString()}
                  </p>
                </div>
              ) : (
                <p className="text-gray-500 mt-2">No one on-call</p>
              )}
            </div>
          );
        })}
      </div>

      {teams.length === 0 && !isLoading && (
        <div className="text-center text-gray-500 py-8">
          <p>No teams found</p>
          <p className="text-sm mt-2">Create a team to manage schedules</p>
        </div>
      )}
    </div>
  );
}
