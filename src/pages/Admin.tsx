import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Clock, Crown, Shield, Trash2, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UserWithAccess {
  id: string;
  email: string;
  isAdmin: boolean;
  expiresAt: Date | null;
  hasAccess: boolean;
}

const Admin = () => {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithAccess[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [accessDuration, setAccessDuration] = useState<string>("7d");
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate("/");
      toast.error("Acesso negado. Apenas administradores.");
    }
  }, [isAdmin, loading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, email");

      if (profilesError) throw profilesError;

      // Get all user roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Get all user access
      const { data: accesses, error: accessError } = await supabase
        .from("user_access")
        .select("user_id, expires_at");

      if (accessError) throw accessError;

      const usersWithAccess: UserWithAccess[] = (profiles || []).map((profile) => {
        const userRoles = roles?.filter((r) => r.user_id === profile.user_id) || [];
        const isUserAdmin = userRoles.some((r) => r.role === "admin");
        const access = accesses?.find((a) => a.user_id === profile.user_id);
        const expiresAt = access ? new Date(access.expires_at) : null;
        const hasAccess = isUserAdmin || (expiresAt ? expiresAt > new Date() : false);

        return {
          id: profile.user_id,
          email: profile.email,
          isAdmin: isUserAdmin,
          expiresAt,
          hasAccess,
        };
      });

      setUsers(usersWithAccess);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Erro ao carregar usuários");
    }
    setIsLoadingUsers(false);
  };

  const getDurationInMs = (duration: string): number => {
    const units: Record<string, number> = {
      "1h": 60 * 60 * 1000,
      "6h": 6 * 60 * 60 * 1000,
      "12h": 12 * 60 * 60 * 1000,
      "1d": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "15d": 15 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
      "90d": 90 * 24 * 60 * 60 * 1000,
      "365d": 365 * 24 * 60 * 60 * 1000,
    };
    return units[duration] || units["7d"];
  };

  const grantAccess = async () => {
    if (!selectedUserId) {
      toast.error("Selecione um usuário");
      return;
    }

    const expiresAt = new Date(Date.now() + getDurationInMs(accessDuration));

    try {
      const { error } = await supabase
        .from("user_access")
        .upsert({
          user_id: selectedUserId,
          expires_at: expiresAt.toISOString(),
        });

      if (error) throw error;

      toast.success("Acesso concedido com sucesso!");
      fetchUsers();
      setSelectedUserId("");
    } catch (error) {
      console.error("Error granting access:", error);
      toast.error("Erro ao conceder acesso");
    }
  };

  const revokeAccess = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("user_access")
        .delete()
        .eq("user_id", userId);

      if (error) throw error;

      toast.success("Acesso revogado!");
      fetchUsers();
    } catch (error) {
      console.error("Error revoking access:", error);
      toast.error("Erro ao revogar acesso");
    }
  };

  const toggleAdmin = async (userId: string, currentlyAdmin: boolean) => {
    try {
      if (currentlyAdmin) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin");

        if (error) throw error;
        toast.success("Privilégios de admin removidos");
      } else {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: "admin" });

        if (error) throw error;
        toast.success("Usuário promovido a admin");
      }

      fetchUsers();
    } catch (error) {
      console.error("Error toggling admin:", error);
      toast.error("Erro ao alterar privilégios");
    }
  };

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-foreground border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary-foreground" />
              <h1 className="text-xl font-bold text-primary-foreground">
                Painel Admin
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Grant Access Card */}
        <Card className="shadow-lg border-primary/20">
          <CardHeader className="bg-gradient-to-r from-secondary/10 to-accent/10">
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-secondary" />
              Conceder Acesso
            </CardTitle>
            <CardDescription>
              Selecione um usuário e defina o tempo de acesso
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Usuário</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {users
                      .filter((u) => !u.isAdmin)
                      .map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.email}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duração do Acesso</Label>
                <Select value={accessDuration} onValueChange={setAccessDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1h">1 hora</SelectItem>
                    <SelectItem value="6h">6 horas</SelectItem>
                    <SelectItem value="12h">12 horas</SelectItem>
                    <SelectItem value="1d">1 dia</SelectItem>
                    <SelectItem value="7d">7 dias</SelectItem>
                    <SelectItem value="15d">15 dias</SelectItem>
                    <SelectItem value="30d">30 dias</SelectItem>
                    <SelectItem value="90d">90 dias</SelectItem>
                    <SelectItem value="365d">1 ano</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={grantAccess}
                  className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Conceder Acesso
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Usuários Cadastrados</CardTitle>
            <CardDescription>
              Gerencie os acessos e permissões dos usuários
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingUsers ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando usuários...
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum usuário cadastrado ainda
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Expira em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.email}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {user.isAdmin && (
                              <Badge className="bg-secondary text-secondary-foreground">
                                <Crown className="h-3 w-3 mr-1" />
                                Admin
                              </Badge>
                            )}
                            {user.hasAccess && !user.isAdmin && (
                              <Badge className="bg-success text-success-foreground">
                                Ativo
                              </Badge>
                            )}
                            {!user.hasAccess && !user.isAdmin && (
                              <Badge variant="destructive">
                                Sem Acesso
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {user.isAdmin ? (
                            <span className="text-muted-foreground">Ilimitado</span>
                          ) : user.expiresAt ? (
                            <span className={user.hasAccess ? "text-success" : "text-destructive"}>
                              {format(user.expiresAt, "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => toggleAdmin(user.id, user.isAdmin)}
                              className="border-secondary/50 hover:bg-secondary/10"
                            >
                              <Crown className="h-4 w-4 mr-1" />
                              {user.isAdmin ? "Remover Admin" : "Tornar Admin"}
                            </Button>
                            {!user.isAdmin && user.hasAccess && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => revokeAccess(user.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Revogar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Admin;
