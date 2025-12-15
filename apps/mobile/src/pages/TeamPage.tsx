import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { teamsApi } from "../lib/api";

interface Team {
  team_id: string;
  name: string;
  aws_account_ids: string[];
}

export default function TeamPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newAwsAccounts, setNewAwsAccounts] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["teams"],
    queryFn: () => teamsApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const accounts = newAwsAccounts
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return teamsApi.create(newTeamName, accounts);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      setShowCreate(false);
      setNewTeamName("");
      setNewAwsAccounts("");
    },
  });

  const teams: Team[] = data?.teams || [];

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Teams</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="text-blue-600 font-medium"
        >
          {showCreate ? "Cancel" : "+ New"}
        </button>
      </div>

      {/* Create team form */}
      {showCreate && (
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <input
            type="text"
            placeholder="Team name"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3"
          />
          <input
            type="text"
            placeholder="AWS Account IDs (comma separated)"
            value={newAwsAccounts}
            onChange={(e) => setNewAwsAccounts(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3"
          />
          <button
            onClick={() => createMutation.mutate()}
            disabled={!newTeamName || createMutation.isPending}
            className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {createMutation.isPending ? "Creating..." : "Create Team"}
          </button>
        </div>
      )}

      {isLoading && (
        <div className="text-center text-gray-500 py-4">Loading...</div>
      )}

      {/* Team list */}
      <div className="space-y-3">
        {teams.map((team) => (
          <div key={team.team_id} className="bg-white rounded-lg shadow p-4">
            <h3 className="font-medium">{team.name}</h3>
            {team.aws_account_ids.length > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                AWS Accounts: {team.aws_account_ids.join(", ")}
              </p>
            )}
          </div>
        ))}
      </div>

      {teams.length === 0 && !isLoading && !showCreate && (
        <div className="text-center text-gray-500 py-8">
          <p>No teams yet</p>
          <p className="text-sm mt-2">Create your first team to get started</p>
        </div>
      )}
    </div>
  );
}
