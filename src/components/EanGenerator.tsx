import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  Barcode, 
  Copy, 
  Download, 
  LogOut, 
  Plus, 
  Settings, 
  Trash2, 
  User 
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SavedEanBase {
  id: string;
  name: string;
  cnpj_prefix: string;
  last_base_code: string;
}

interface EanCode {
  code: string;
  baseCode: string;
}

const calculateEanCheckDigit = (code: string): string => {
  const digits = code.split("").map(Number);
  let sum = 0;

  for (let i = 0; i < 12; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit.toString();
};

const EanGenerator = () => {
  const { user, isAdmin, hasAccess, accessExpiresAt, signOut, loading } = useAuth();
  const navigate = useNavigate();

  // Saved EAN bases
  const [savedBases, setSavedBases] = useState<SavedEanBase[]>([]);
  const [selectedBase, setSelectedBase] = useState<SavedEanBase | null>(null);
  const [isLoadingBases, setIsLoadingBases] = useState(true);

  // New base form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCnpjPrefix, setNewCnpjPrefix] = useState("");

  // Generation
  const [quantity, setQuantity] = useState("1");
  const [generatedCodes, setGeneratedCodes] = useState<EanCode[]>([]);

  useEffect(() => {
    if (!loading && user && hasAccess) {
      fetchSavedBases();
    }
  }, [loading, user, hasAccess]);

  const fetchSavedBases = async () => {
    if (!user) return;

    setIsLoadingBases(true);
    try {
      const { data, error } = await supabase
        .from("saved_ean_bases")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

      if (error) throw error;
      setSavedBases(data || []);
    } catch (error) {
      console.error("Error fetching saved bases:", error);
      toast.error("Erro ao carregar bases salvas");
    }
    setIsLoadingBases(false);
  };

  const createNewBase = async () => {
    if (!user) return;

    if (!newName.trim()) {
      toast.error("Digite um nome para identificar");
      return;
    }

    if (newCnpjPrefix.length !== 5 || !/^\d+$/.test(newCnpjPrefix)) {
      toast.error("Digite exatamente 5 dígitos do CNPJ");
      return;
    }

    // Create initial 12-digit base code: 789 (Brazil) + 5 CNPJ digits + 0001 (sequential start)
    const initialBaseCode = `789${newCnpjPrefix}0001`;

    try {
      const { data, error } = await supabase
        .from("saved_ean_bases")
        .insert({
          user_id: user.id,
          name: newName.trim(),
          cnpj_prefix: newCnpjPrefix,
          last_base_code: initialBaseCode,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`Base "${newName}" criada com sucesso!`);
      setSavedBases([...savedBases, data]);
      setNewName("");
      setNewCnpjPrefix("");
      setShowNewForm(false);
      setSelectedBase(data);
    } catch (error: any) {
      if (error.code === "23505") {
        toast.error("Já existe uma base com esse nome");
      } else {
        toast.error("Erro ao criar base");
      }
    }
  };

  const deleteBase = async (base: SavedEanBase) => {
    try {
      const { error } = await supabase
        .from("saved_ean_bases")
        .delete()
        .eq("id", base.id);

      if (error) throw error;

      toast.success(`Base "${base.name}" removida`);
      setSavedBases(savedBases.filter((b) => b.id !== base.id));
      if (selectedBase?.id === base.id) {
        setSelectedBase(null);
        setGeneratedCodes([]);
      }
    } catch (error) {
      toast.error("Erro ao remover base");
    }
  };

  const generateEans = async () => {
    if (!selectedBase || !user) return;

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty < 1 || qty > 1000) {
      toast.error("Quantidade deve ser entre 1 e 1000");
      return;
    }

    const codes: EanCode[] = [];
    const startNumber = parseInt(selectedBase.last_base_code);

    for (let i = 0; i < qty; i++) {
      const currentBase = (startNumber + i).toString().padStart(12, "0");
      const checkDigit = calculateEanCheckDigit(currentBase);
      const fullCode = currentBase + checkDigit;

      codes.push({
        code: fullCode,
        baseCode: currentBase,
      });
    }

    const lastGenerated = codes[codes.length - 1].baseCode;
    const nextBaseCode = (parseInt(lastGenerated) + 1).toString().padStart(12, "0");

    // Update the last base code in database
    try {
      const { error } = await supabase
        .from("saved_ean_bases")
        .update({ last_base_code: nextBaseCode })
        .eq("id", selectedBase.id);

      if (error) throw error;

      // Update local state
      const updatedBase = { ...selectedBase, last_base_code: nextBaseCode };
      setSelectedBase(updatedBase);
      setSavedBases(savedBases.map((b) => (b.id === selectedBase.id ? updatedBase : b)));
    } catch (error) {
      toast.error("Erro ao salvar último código");
    }

    setGeneratedCodes(codes);
    toast.success(`${qty} código(s) EAN-13 gerado(s)!`);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado!");
  };

  const copyAllCodes = () => {
    const allCodes = generatedCodes.map((c) => c.code).join("\n");
    navigator.clipboard.writeText(allCodes);
    toast.success("Todos os códigos copiados!");
  };

  const downloadCodes = () => {
    const allCodes = generatedCodes.map((c) => c.code).join("\n");
    const blob = new Blob([allCodes], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ean-codes-${selectedBase?.name || "export"}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Arquivo baixado!");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-foreground border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    navigate("/login");
    return null;
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-primary shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Barcode className="h-8 w-8 text-primary-foreground" />
              <h1 className="text-xl font-bold text-primary-foreground">
                Gerador de EAN-13
              </h1>
            </div>
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <LogOut className="h-5 w-5 mr-2" />
              Sair
            </Button>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-16">
          <Card className="shadow-xl border-destructive/20">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                <User className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-destructive">Acesso Expirado</CardTitle>
              <CardDescription>
                {accessExpiresAt
                  ? `Seu acesso expirou em ${format(accessExpiresAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                  : "Você ainda não tem acesso liberado para usar o gerador."}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground">
                Entre em contato com o administrador para renovar seu acesso.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Barcode className="h-8 w-8 text-primary-foreground" />
            <h1 className="text-xl font-bold text-primary-foreground">
              Gerador de EAN-13
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {!isAdmin && accessExpiresAt && (
              <span className="text-sm text-primary-foreground/80 hidden md:block">
                Acesso expira {formatDistanceToNow(accessExpiresAt, { locale: ptBR, addSuffix: true })}
              </span>
            )}
            {isAdmin && (
              <Button
                variant="ghost"
                onClick={() => navigate("/admin")}
                className="text-primary-foreground hover:bg-primary-foreground/10"
              >
                <Settings className="h-5 w-5 mr-2" />
                Admin
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <LogOut className="h-5 w-5 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Saved Bases Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-r from-secondary/10 to-primary/10 pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">EANs Base Salvos</CardTitle>
                  <Button
                    size="sm"
                    onClick={() => setShowNewForm(!showNewForm)}
                    className="bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Novo
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {/* New Base Form */}
                {showNewForm && (
                  <div className="mb-4 p-4 bg-muted rounded-lg space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="newName">Nome/Identificador</Label>
                      <Input
                        id="newName"
                        placeholder="Ex: Marcos, Loja X"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newCnpj">5 Primeiros Dígitos do CNPJ</Label>
                      <Input
                        id="newCnpj"
                        placeholder="42821"
                        maxLength={5}
                        value={newCnpjPrefix}
                        onChange={(e) =>
                          setNewCnpjPrefix(e.target.value.replace(/\D/g, ""))
                        }
                      />
                    </div>
                    <Button
                      onClick={createNewBase}
                      className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                    >
                      Criar Base
                    </Button>
                  </div>
                )}

                {/* Saved Bases List */}
                {isLoadingBases ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </div>
                ) : savedBases.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Nenhuma base salva</p>
                    <p className="text-sm mt-1">
                      Clique em "Novo" para criar
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {savedBases.map((base) => (
                      <div
                        key={base.id}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedBase?.id === base.id
                            ? "border-secondary bg-secondary/10"
                            : "border-border hover:border-secondary/50 hover:bg-muted/50"
                        }`}
                        onClick={() => {
                          setSelectedBase(base);
                          setGeneratedCodes([]);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-foreground">
                              {base.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              CNPJ: {base.cnpj_prefix}... | Último:{" "}
                              <span className="font-mono">
                                {base.last_base_code}
                              </span>
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteBase(base);
                            }}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Generator Panel */}
          <div className="lg:col-span-2 space-y-6">
            {selectedBase ? (
              <>
                {/* Generation Card */}
                <Card className="shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-primary/10 to-secondary/10">
                    <CardTitle className="flex items-center gap-2">
                      <Barcode className="h-5 w-5" />
                      Gerar EANs para: {selectedBase.name}
                    </CardTitle>
                    <CardDescription>
                      Próximo código base:{" "}
                      <span className="font-mono font-bold text-foreground">
                        {selectedBase.last_base_code}
                      </span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="flex gap-4">
                      <div className="flex-1 space-y-2">
                        <Label htmlFor="quantity">Quantidade de EANs</Label>
                        <Input
                          id="quantity"
                          type="number"
                          min="1"
                          max="1000"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          placeholder="10"
                          className="text-lg font-mono"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          onClick={generateEans}
                          size="lg"
                          className="h-11 px-8 bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold"
                        >
                          Gerar EANs
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Generated Codes */}
                {generatedCodes.length > 0 && (
                  <Card className="shadow-lg">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Códigos Gerados</CardTitle>
                          <CardDescription>
                            {generatedCodes.length} código(s) EAN-13
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={copyAllCodes}
                            className="border-secondary/50 hover:bg-secondary/10"
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copiar Todos
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={downloadCodes}
                            className="border-secondary/50 hover:bg-secondary/10"
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Baixar .txt
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                        {generatedCodes.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                          >
                            <span className="font-mono text-lg font-bold text-foreground">
                              {item.code}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyCode(item.code)}
                              className="hover:bg-secondary/20"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card className="shadow-lg">
                <CardContent className="py-16 text-center text-muted-foreground">
                  <Barcode className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">Selecione uma base salva</p>
                  <p className="text-sm mt-1">
                    Ou crie uma nova clicando em "Novo"
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default EanGenerator;
